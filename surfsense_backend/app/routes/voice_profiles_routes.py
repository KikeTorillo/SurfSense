"""CRUD routes for voice profiles (voice library)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import (
    Permission,
    User,
    VoiceProfile,
    VoiceType,
    get_async_session,
)
from app.schemas.voice_profiles import (
    VoicePreviewRequest,
    VoiceProfileCreate,
    VoiceProfileRead,
    VoiceProfileUpdate,
)
from app.users import current_active_user
from app.utils.rbac import check_permission

router = APIRouter()


@router.post("/voice-profiles", response_model=VoiceProfileRead)
async def create_voice_profile(
    body: VoiceProfileCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create a new voice profile (preset or design type)."""
    await check_permission(
        session, user, body.search_space_id, Permission.PODCASTS_CREATE
    )
    profile = VoiceProfile(
        name=body.name,
        search_space_id=body.search_space_id,
        voice_type=VoiceType(body.voice_type),
        preset_voice_id=body.preset_voice_id,
        design_instructions=body.design_instructions,
        style_instructions=body.style_instructions,
        language=body.language,
        created_by=user.id,
    )
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.post("/voice-profiles/clone", response_model=VoiceProfileRead)
async def create_clone_voice_profile(
    search_space_id: int = Form(...),
    name: str = Form(...),
    ref_text: str = Form(""),
    language: str = Form(""),
    style_instructions: str = Form(""),
    audio_file: UploadFile = File(...),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create a clone voice profile with reference audio upload."""
    await check_permission(
        session, user, search_space_id, Permission.PODCASTS_CREATE
    )

    # Generate unique profile ID for the voice library
    clone_id = f"voice_{uuid.uuid4().hex[:12]}"

    # Save audio to the shared voice library volume
    import os
    voice_lib_dir = os.environ.get("VOICE_LIBRARY_DIR", "/shared_tmp/voice_library")
    profile_dir = os.path.join(voice_lib_dir, "profiles", clone_id)
    os.makedirs(profile_dir, exist_ok=True)

    # Save and convert audio to WAV (qwen3-tts requires WAV format)
    audio_data = await audio_file.read()
    raw_path = os.path.join(profile_dir, "reference_raw")
    audio_path = os.path.join(profile_dir, "reference.wav")
    with open(raw_path, "wb") as f:
        f.write(audio_data)

    # Convert to WAV using ffmpeg (handles any input format)
    import subprocess
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", raw_path, "-ar", "24000", "-ac", "1", audio_path],
            capture_output=True, check=True, timeout=30,
        )
        os.remove(raw_path)
    except Exception:
        # Fallback: keep raw file as-is
        os.rename(raw_path, audio_path)

    # Save meta.json for qwen3-tts voice library
    import json
    meta = {
        "profile_id": clone_id,
        "name": name,
        "ref_audio_filename": "reference.wav",
        "ref_text": ref_text or "",
        "language": language or "es",
        "x_vector_only_mode": False,
    }
    with open(os.path.join(profile_dir, "meta.json"), "w") as f:
        json.dump(meta, f)

    profile = VoiceProfile(
        name=name,
        search_space_id=search_space_id,
        voice_type=VoiceType.CLONE,
        clone_profile_id=clone_id,
        clone_ref_text=ref_text or None,
        style_instructions=style_instructions or None,
        language=language or None,
        created_by=user.id,
    )
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.get("/voice-profiles", response_model=list[VoiceProfileRead])
async def list_voice_profiles(
    search_space_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """List voice profiles for a search space."""
    await check_permission(
        session, user, search_space_id, Permission.PODCASTS_READ
    )
    result = await session.execute(
        select(VoiceProfile)
        .filter(VoiceProfile.search_space_id == search_space_id)
        .order_by(VoiceProfile.created_at.desc())
    )
    return result.scalars().all()


@router.get("/voice-profiles/{profile_id}", response_model=VoiceProfileRead)
async def get_voice_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Get a single voice profile."""
    result = await session.execute(
        select(VoiceProfile).filter(VoiceProfile.id == profile_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    await check_permission(
        session, user, profile.search_space_id, Permission.PODCASTS_READ
    )
    return profile


@router.put("/voice-profiles/{profile_id}", response_model=VoiceProfileRead)
async def update_voice_profile(
    profile_id: int,
    body: VoiceProfileUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Update a voice profile."""
    result = await session.execute(
        select(VoiceProfile).filter(VoiceProfile.id == profile_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    await check_permission(
        session, user, profile.search_space_id, Permission.PODCASTS_UPDATE
    )

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)
    profile.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(profile)
    return profile


@router.delete("/voice-profiles/{profile_id}")
async def delete_voice_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Delete a voice profile and its associated files."""
    result = await session.execute(
        select(VoiceProfile).filter(VoiceProfile.id == profile_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    await check_permission(
        session, user, profile.search_space_id, Permission.PODCASTS_DELETE
    )

    # Clean up clone files if applicable
    if profile.voice_type == VoiceType.CLONE and profile.clone_profile_id:
        import os
        import shutil
        voice_lib_dir = os.environ.get("VOICE_LIBRARY_DIR", "/shared_tmp/voice_library")
        profile_dir = os.path.join(voice_lib_dir, "profiles", profile.clone_profile_id)
        if os.path.exists(profile_dir):
            shutil.rmtree(profile_dir)

    await session.delete(profile)
    await session.commit()
    return {"status": "deleted", "id": profile_id}


@router.post("/voice-profiles/{profile_id}/preview")
async def preview_voice_profile(
    profile_id: int,
    body: VoicePreviewRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Generate a preview audio for a voice profile."""
    result = await session.execute(
        select(VoiceProfile).filter(VoiceProfile.id == profile_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    await check_permission(
        session, user, profile.search_space_id, Permission.PODCASTS_READ
    )

    # Build TTS request via direct HTTP to proxy (litellm doesn't pass instruct)
    from app.services.tts_router_service import TTSRouterService

    if not TTSRouterService.is_initialized():
        raise HTTPException(status_code=503, detail="TTS service not available")

    deployment = TTSRouterService.get_first_deployment_params()
    if not deployment:
        raise HTTPException(status_code=503, detail="No TTS deployment configured")

    api_base = deployment.get("api_base", "")
    lang = profile.language
    tts_model = "tts-1"
    if lang and lang != "en":
        tts_model = f"tts-1-{lang}"

    # Build OpenAI-compatible body
    tts_body: dict = {
        "model": tts_model,
        "input": body.text,
    }

    if profile.voice_type == VoiceType.PRESET:
        tts_body["voice"] = profile.preset_voice_id or "alloy"
        if profile.style_instructions:
            tts_body["instruct"] = profile.style_instructions
    elif profile.voice_type == VoiceType.DESIGN:
        tts_body["voice"] = "voice_design"
        tts_body["instruct"] = profile.design_instructions or "A neutral narrator"
    elif profile.voice_type == VoiceType.CLONE:
        tts_body["voice"] = f"clone:{profile.clone_profile_id}"

    try:
        import httpx

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{api_base}/audio/speech", json=tts_body)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"TTS preview failed: {resp.text}",
                )
            return Response(
                content=resp.content,
                media_type="audio/mpeg",
                headers={"Content-Disposition": f"inline; filename=preview_{profile_id}.mp3"},
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"TTS preview failed: {e}")
