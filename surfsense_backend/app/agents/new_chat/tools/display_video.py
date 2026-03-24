"""
Display video tool for the SurfSense agent.

This module provides a tool for displaying videos in the chat UI
with metadata like title, description, and source attribution.
"""

import hashlib
from typing import Any
from urllib.parse import urlparse

from langchain_core.tools import tool


def extract_domain(url: str) -> str:
    """Extract the domain from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def generate_video_id(src: str) -> str:
    """Generate a unique ID for a video."""
    hash_val = hashlib.md5(src.encode()).hexdigest()[:12]
    return f"video-{hash_val}"


def create_display_video_tool():
    """
    Factory function to create the display_video tool.

    Returns:
        A configured tool function for displaying videos.
    """

    @tool
    async def display_video(
        src: str,
        alt: str = "Video",
        title: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """
        Display a video in the chat with metadata.

        Use this tool when you want to show a video to the user.
        This displays the video with an optional title, description,
        and source attribution.

        Args:
            src: The URL of the video to display (must be a valid HTTP/HTTPS URL)
            alt: Alternative text describing the video (for accessibility)
            title: Optional title to display below the video
            description: Optional description providing context about the video

        Returns:
            A dictionary containing video metadata for the UI to render:
            - id: Unique identifier for this video
            - assetId: The video URL (for deduplication)
            - src: The video URL
            - alt: Alt text for accessibility
            - title: Video title (if provided)
            - description: Video description (if provided)
            - domain: Source domain
        """
        video_id = generate_video_id(src)

        if not src.startswith(("http://", "https://")):
            src = f"https://{src}"

        domain = extract_domain(src)

        is_generated = "/video-generations/" in src
        if is_generated:
            domain = "ai-generated"

        return {
            "id": video_id,
            "assetId": src,
            "src": src,
            "alt": alt,
            "title": title,
            "description": description,
            "domain": domain,
        }

    return display_video
