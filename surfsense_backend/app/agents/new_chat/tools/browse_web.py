"""
Browser automation tool for the SurfSense agent.

This module provides a tool that uses browser-use to give the agent
real browser interaction capabilities: navigating pages, extracting
JS-rendered content, filling forms, and multi-step web research.

The tool wraps browser-use's internal agent loop — each invocation
spawns a headless Chromium browser, runs the task autonomously, and
returns the extracted content.
"""

import asyncio
import logging
import os
import time
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
BROWSER_USE_MAX_CONCURRENT = int(os.environ.get("BROWSER_USE_MAX_CONCURRENT", "2"))
BROWSER_USE_TASK_TIMEOUT = int(os.environ.get("BROWSER_USE_TASK_TIMEOUT", "120"))
BROWSER_USE_MAX_CONTENT_LENGTH = int(
    os.environ.get("BROWSER_USE_MAX_CONTENT_LENGTH", "50000")
)

# Global semaphore — limits concurrent browser instances across all requests
_browser_semaphore = asyncio.Semaphore(BROWSER_USE_MAX_CONCURRENT)


def _truncate_content(content: str, max_length: int) -> tuple[str, bool]:
    """Truncate content to *max_length* chars at a sentence boundary."""
    if len(content) <= max_length:
        return content, False
    truncated = content[:max_length]
    last_period = truncated.rfind(".")
    last_newline = truncated.rfind("\n\n")
    boundary = max(last_period, last_newline)
    if boundary > max_length * 0.8:
        truncated = content[: boundary + 1]
    return truncated + "\n\n[Content truncated...]", True


def create_browse_web_tool(
    llm: BaseChatModel,
):
    """
    Factory function to create the browse_web tool.

    Args:
        llm: The LLM instance to use for browser-use's internal agent loop.
    """

    @tool
    async def browse_web(
        task: str,
        max_steps: int = 15,
    ) -> dict[str, Any]:
        """
        Browse the web interactively using a real browser.

        Use this tool when you need to interact with web pages that require
        JavaScript rendering, multi-step navigation, form filling, or when
        scrape_webpage fails to extract the content you need.

        This tool spawns a headless Chromium browser and autonomously navigates,
        clicks, types, and extracts information based on the task description.

        Args:
            task: A detailed natural language description of what to do in the
                  browser. Be specific about what URL to visit and what
                  information to extract or action to perform.
            max_steps: Maximum number of browser actions to take (default: 15,
                       max: 30). Higher values allow more complex tasks but
                       take longer and cost more in LLM calls.

        Returns:
            A dictionary containing the browsing result with extracted content,
            URLs visited, and task status.
        """
        try:
            from browser_use import Agent, Browser, BrowserConfig
        except ImportError:
            return {
                "status": "error",
                "error": "browser-use is not installed. Install it with: pip install browser-use",
            }

        # Clamp max_steps
        max_steps = max(1, min(max_steps, 30))

        start_time = time.time()
        browser = None

        try:
            async with _browser_semaphore:
                # Configure headless Chromium with security flags
                browser_config = BrowserConfig(
                    headless=True,
                    extra_browser_args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        # Block access to internal Docker network IPs (SSRF protection)
                        "--host-resolver-rules="
                        "MAP * ~NOTFOUND, "
                        "EXCLUDE *.*, "  # Allow all public domains
                        "MAP 10.* ~NOTFOUND, "
                        "MAP 172.16.* ~NOTFOUND, "
                        "MAP 172.17.* ~NOTFOUND, "
                        "MAP 172.18.* ~NOTFOUND, "
                        "MAP 172.19.* ~NOTFOUND, "
                        "MAP 172.20.* ~NOTFOUND, "
                        "MAP 172.21.* ~NOTFOUND, "
                        "MAP 172.22.* ~NOTFOUND, "
                        "MAP 172.23.* ~NOTFOUND, "
                        "MAP 172.24.* ~NOTFOUND, "
                        "MAP 172.25.* ~NOTFOUND, "
                        "MAP 172.26.* ~NOTFOUND, "
                        "MAP 172.27.* ~NOTFOUND, "
                        "MAP 172.28.* ~NOTFOUND, "
                        "MAP 172.29.* ~NOTFOUND, "
                        "MAP 172.30.* ~NOTFOUND, "
                        "MAP 172.31.* ~NOTFOUND, "
                        "MAP 192.168.* ~NOTFOUND, "
                        "MAP localhost ~NOTFOUND, "
                        "MAP 127.0.0.1 ~NOTFOUND",
                    ],
                )
                browser = Browser(config=browser_config)

                agent = Agent(
                    task=task,
                    llm=llm,
                    browser=browser,
                    max_steps=max_steps,
                    use_vision=False,
                )

                # Run with timeout
                history = await asyncio.wait_for(
                    agent.run(),
                    timeout=BROWSER_USE_TASK_TIMEOUT,
                )

                duration = time.time() - start_time

                # Extract results from AgentHistoryList
                final_result = history.final_result() or ""
                urls_visited = history.urls() or []
                actions_taken = history.number_of_steps()
                errors = history.errors() or []
                non_none_errors = [str(e) for e in errors if e is not None]

                # Collect all extracted content
                all_content = history.extracted_content() or []
                combined_content = final_result
                if not combined_content and all_content:
                    combined_content = "\n\n".join(
                        str(c) for c in all_content if c
                    )

                # Truncate if needed
                if combined_content:
                    combined_content, _ = _truncate_content(
                        combined_content, BROWSER_USE_MAX_CONTENT_LENGTH
                    )

                status = "success" if history.is_done() else "partial"
                if non_none_errors and not combined_content:
                    status = "error"

                result = {
                    "status": status,
                    "extracted_content": combined_content,
                    "urls_visited": urls_visited,
                    "actions_taken": actions_taken,
                    "duration_seconds": round(duration, 1),
                }

                if non_none_errors:
                    result["errors"] = non_none_errors[:3]

                return result

        except TimeoutError:
            duration = time.time() - start_time
            return {
                "status": "timeout",
                "error": f"Browser task exceeded the {BROWSER_USE_TASK_TIMEOUT}s timeout",
                "duration_seconds": round(duration, 1),
            }
        except Exception as e:
            duration = time.time() - start_time
            logger.exception("browse_web tool failed")
            return {
                "status": "error",
                "error": f"Browser task failed: {e!s}",
                "duration_seconds": round(duration, 1),
            }
        finally:
            if browser is not None:
                try:
                    await browser.close()
                except Exception:
                    logger.warning("Failed to close browser instance", exc_info=True)

    return browse_web
