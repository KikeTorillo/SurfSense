"""
Video generation tool for the SurfSense agent.

This module provides a tool that generates videos using the VideoGenService
(direct HTTP calls to ComfyUI proxy) and returns the result for the frontend
to render inline in the chat.

Config resolution:
1. Uses the search space's video_generation_config_id preference
2. Falls back to the first global YAML config
"""

import base64
import logging
from pathlib import Path
from typing import Any

import aiohttp
from langchain_core.tools import tool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.db import SearchSpace, VideoGeneration, VideoGenerationConfig
from app.services.video_gen_service import VideoGenService
from app.utils.signed_image_urls import generate_image_token

logger = logging.getLogger(__name__)

VIDEO_GENERATION_DIR = Path("/shared_tmp/video_generation")


def _get_global_video_gen_config(config_id: int) -> dict | None:
    """Get a global video gen config by negative ID."""
    for cfg in config.GLOBAL_VIDEO_GEN_CONFIGS:
        if cfg.get("id") == config_id:
            return cfg
    return None


def create_generate_video_tool(
    search_space_id: int,
    db_session: AsyncSession,
    user_image_data_urls: list[str] | None = None,
):
    """
    Factory function to create the generate_video tool.

    Args:
        search_space_id: The search space ID (for config resolution)
        db_session: Async database session
        user_image_data_urls: Base64 data URLs of images attached by the user in the current message
    """

    @tool
    async def generate_video(
        prompt: str,
        mode: str = "t2v",
        image_url: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate a video from a text description or from an image using AI video models.

        Use this tool when the user asks you to create, generate, or make a video,
        animation, or clip. The generated video will be displayed in the chat.

        When the user attached an image in this conversation and asks to animate it
        or generate a video from it, use mode="i2v". The attached image will be used
        automatically — you do NOT need to pass the image data in image_url.

        Args:
            prompt: A detailed text description of the video to generate.
                    Be specific about subject, action, style, and mood.
            mode: Generation mode — "t2v" for text-to-video (default),
                  "i2v" for image-to-video. When the user has attached an image
                  and asks to animate or create a video from it, use "i2v".
            image_url: Optional HTTP URL of a source image for i2v mode.
                       Not needed when the user attached an image in the chat —
                       the attached image is used automatically.

        Returns:
            A dictionary containing the generated video URL for display in the chat.
        """
        try:
            # Resolve video generation config from search space preference
            result = await db_session.execute(
                select(SearchSpace).filter(SearchSpace.id == search_space_id)
            )
            search_space = result.scalars().first()
            if not search_space:
                return {"error": "Search space not found"}

            config_id = search_space.video_generation_config_id
            if config_id is None:
                # Fallback to first global config
                global_configs = config.GLOBAL_VIDEO_GEN_CONFIGS
                if global_configs:
                    config_id = global_configs[0].get("id")
            if config_id is None:
                return {
                    "error": "No video generation models configured. "
                    "Please add a video model in Settings > Video Models."
                }

            # Resolve config details
            if config_id < 0:
                cfg = _get_global_video_gen_config(config_id)
                if not cfg:
                    return {"error": f"Video generation config {config_id} not found"}
                api_base = cfg.get("api_base", "")
                api_key = cfg.get("api_key", "")
                default_model = cfg.get("model_name", "ltx-2.3-t2v")
                extra = cfg.get("extra_params", {}) or {}
            else:
                cfg_result = await db_session.execute(
                    select(VideoGenerationConfig).filter(
                        VideoGenerationConfig.id == config_id
                    )
                )
                db_cfg = cfg_result.scalars().first()
                if not db_cfg:
                    return {"error": f"Video generation config {config_id} not found"}
                api_base = db_cfg.api_base or ""
                api_key = db_cfg.api_key
                default_model = db_cfg.model_name
                extra = db_cfg.extra_params or {}

            if not api_base:
                return {"error": "Video generation config is missing api_base"}

            # Determine model based on mode
            model = default_model
            if mode == "i2v":
                # Switch to i2v model variant
                if "t2v" in model:
                    model = model.replace("t2v", "i2v")

            size = extra.get("size", "768x512")
            frames = extra.get("frames", 97)

            # For i2v mode, resolve the source image to base64
            image_base64 = None
            if mode == "i2v":
                # Priority: 1) user-attached images from current message, 2) explicit image_url
                source_url = None
                if user_image_data_urls:
                    source_url = user_image_data_urls[0]
                elif image_url:
                    source_url = image_url

                if not source_url:
                    return {"error": "No image available for i2v mode. The user needs to attach an image."}

                try:
                    if source_url.startswith("data:image/"):
                        # Already a base64 data URL — extract the payload
                        image_base64 = source_url.split(",", 1)[1] if "," in source_url else source_url
                    else:
                        # HTTP(S) URL — download the image
                        async with aiohttp.ClientSession() as http_session:
                            async with http_session.get(
                                source_url,
                                timeout=aiohttp.ClientTimeout(total=30),
                            ) as resp:
                                if resp.status != 200:
                                    return {"error": f"Failed to download image from {source_url}"}
                                image_bytes = await resp.read()
                                image_base64 = base64.b64encode(image_bytes).decode("utf-8")
                except Exception as e:
                    return {"error": f"Failed to resolve source image: {e!s}"}

            # Call video generation API
            response = await VideoGenService.generate_video(
                api_base=api_base,
                api_key=api_key,
                prompt=prompt,
                model=model,
                size=size,
                frames=frames,
                image_base64=image_base64,
            )

            # Extract video data
            data = response.get("data", [])
            if not data or not data[0].get("b64_json"):
                return {"error": "No video data in response"}

            # Generate access token and save to DB
            access_token = generate_image_token()

            # Decode and save video to disk
            VIDEO_GENERATION_DIR.mkdir(parents=True, exist_ok=True)
            video_bytes = base64.b64decode(data[0]["b64_json"])

            db_video_gen = VideoGeneration(
                prompt=prompt,
                model=model,
                mode=mode,
                size=size,
                frames=frames,
                video_generation_config_id=config_id,
                search_space_id=search_space_id,
                access_token=access_token,
            )
            db_session.add(db_video_gen)
            await db_session.flush()

            video_path = VIDEO_GENERATION_DIR / f"{db_video_gen.id}.mp4"
            video_path.write_bytes(video_bytes)
            db_video_gen.video_path = str(video_path)

            await db_session.commit()
            await db_session.refresh(db_video_gen)

            # Build serving URL
            backend_url = config.BACKEND_URL or "http://localhost:8000"
            video_url = (
                f"{backend_url}/api/v1/video-generations/"
                f"{db_video_gen.id}/video?token={access_token}"
            )

            revised = data[0].get("revised_prompt", prompt)

            return {
                "src": video_url,
                "alt": revised or prompt,
                "title": "Generated Video",
                "description": revised if revised != prompt else None,
                "generated": True,
                "prompt": prompt,
                "mode": mode,
            }

        except Exception as e:
            logger.exception("Video generation failed in tool")
            return {
                "error": f"Video generation failed: {e!s}",
                "prompt": prompt,
            }

    return generate_video
