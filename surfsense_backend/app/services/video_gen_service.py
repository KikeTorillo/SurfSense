"""
Video Generation Service — Direct HTTP client.

Unlike image/LLM/TTS generation which use LiteLLM, video generation calls
the API directly because LiteLLM does not support video generation.

The service sends POST requests to OpenAI-compatible video generation endpoints
(e.g., the local ComfyUI proxy at /v1/videos/generations).
"""

import logging
from typing import Any

import aiohttp

logger = logging.getLogger(__name__)

# Long timeout — LTX-2.3 takes ~57s for t2v, ~85s for i2v
_DEFAULT_TIMEOUT = 300


class VideoGenService:
    """Direct HTTP client for video generation APIs."""

    @staticmethod
    async def generate_video(
        api_base: str,
        api_key: str,
        prompt: str,
        model: str = "ltx-2.3-t2v",
        size: str = "768x512",
        frames: int = 97,
        image_base64: str | None = None,
        timeout: int = _DEFAULT_TIMEOUT,
    ) -> dict[str, Any]:
        """
        Call a video generation API.

        Args:
            api_base: Base URL of the API (e.g., "http://comfyui-proxy:8080")
            api_key: API key for authentication
            prompt: Text description of the desired video
            model: Model name (e.g., "ltx-2.3-t2v", "ltx-2.3-i2v")
            size: Video dimensions (e.g., "768x512")
            frames: Number of frames to generate
            image_base64: Base64-encoded image (required for i2v mode)
            timeout: Request timeout in seconds

        Returns:
            Response dict: {"created": int, "data": [{"b64_json": str, "revised_prompt": str}]}

        Raises:
            ValueError: If the API returns an error
            aiohttp.ClientError: On network errors
        """
        url = f"{api_base.rstrip('/')}/v1/videos/generations"

        body: dict[str, Any] = {
            "prompt": prompt,
            "model": model,
            "size": size,
            "frames": frames,
        }
        if image_base64:
            body["image"] = image_base64

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key and api_key != "local":
            headers["Authorization"] = f"Bearer {api_key}"

        logger.info(
            "Video generation request: model=%s size=%s frames=%d prompt=%.80s",
            model, size, frames, prompt,
        )

        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=body,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as resp:
                response_data = await resp.json()

                if resp.status != 200:
                    error_msg = "Unknown error"
                    if isinstance(response_data, dict):
                        error = response_data.get("error", {})
                        if isinstance(error, dict):
                            error_msg = error.get("message", str(error))
                        elif isinstance(error, str):
                            error_msg = error
                    raise ValueError(
                        f"Video generation API error (HTTP {resp.status}): {error_msg}"
                    )

                return response_data
