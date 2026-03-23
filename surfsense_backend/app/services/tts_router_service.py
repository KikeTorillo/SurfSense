"""
TTS Router Service for Load Balancing

Singleton LiteLLM Router for automatic load balancing across multiple TTS
deployments. Uses litellm.Router which natively supports aspeech() for
async text-to-speech generation.

The router handles:
- Rate limit management with automatic cooldowns
- Automatic failover and retries
- Usage-based routing to distribute load evenly

Supported providers: OpenAI, Azure, Vertex AI, and any OpenAI-compatible
TTS service (Kokoro, Qwen3-TTS via api_base).
"""

import logging
from typing import Any

from litellm import Router

logger = logging.getLogger(__name__)

# Special ID for Auto mode - uses router for load balancing
TTS_AUTO_MODE_ID = 0

# Provider mapping for LiteLLM model string construction.
TTS_PROVIDER_MAP = {
    "OPENAI": "openai",
    "AZURE": "azure",
    "VERTEX_AI": "vertex_ai",
}


class TTSRouterService:
    """
    Singleton service for managing LiteLLM Router for TTS.

    The router provides automatic load balancing, failover, and rate limit
    handling across multiple TTS deployments.
    Uses Router.aspeech() for async TTS calls.
    """

    _instance = None
    _router: Router | None = None
    _model_list: list[dict] = []
    _router_settings: dict = {}
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls) -> "TTSRouterService":
        """Get the singleton instance of the router service."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def initialize(
        cls,
        global_configs: list[dict],
        router_settings: dict | None = None,
    ) -> None:
        """
        Initialize the router with global TTS configurations.

        Args:
            global_configs: List of global TTS config dictionaries from YAML
            router_settings: Optional router settings (routing_strategy, num_retries, etc.)
        """
        instance = cls.get_instance()

        if instance._initialized:
            logger.debug("TTS Router already initialized, skipping")
            return

        # Build model list from global configs
        model_list = []
        for config in global_configs:
            deployment = cls._config_to_deployment(config)
            if deployment:
                model_list.append(deployment)

        if not model_list:
            logger.warning(
                "No valid TTS configs found for router initialization"
            )
            return

        instance._model_list = model_list
        instance._router_settings = router_settings or {}

        # Default router settings
        default_settings = {
            "routing_strategy": "usage-based-routing",
            "num_retries": 2,
            "allowed_fails": 3,
            "cooldown_time": 60,
            "retry_after": 5,
        }

        final_settings = {**default_settings, **instance._router_settings}

        try:
            instance._router = Router(
                model_list=model_list,
                routing_strategy=final_settings.get(
                    "routing_strategy", "usage-based-routing"
                ),
                num_retries=final_settings.get("num_retries", 2),
                allowed_fails=final_settings.get("allowed_fails", 3),
                cooldown_time=final_settings.get("cooldown_time", 60),
                set_verbose=False,
            )
            instance._initialized = True
            logger.info(
                f"TTS Router initialized with {len(model_list)} deployments, "
                f"strategy: {final_settings.get('routing_strategy')}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize TTS Router: {e}")
            instance._router = None

    @classmethod
    def _config_to_deployment(cls, config: dict) -> dict | None:
        """
        Convert a global TTS config to a router deployment entry.

        Args:
            config: Global TTS config dictionary

        Returns:
            Router deployment dictionary or None if invalid
        """
        try:
            if not config.get("model_name"):
                return None

            # Build model string: use model_name directly if it already
            # contains a provider prefix (e.g., "openai/tts-1")
            model_name = config["model_name"]
            if "/" in model_name:
                model_string = model_name
            elif config.get("custom_provider"):
                model_string = f"{config['custom_provider']}/{model_name}"
            else:
                provider = config.get("provider", "").upper()
                provider_prefix = TTS_PROVIDER_MAP.get(provider, provider.lower())
                model_string = f"{provider_prefix}/{model_name}"

            litellm_params: dict[str, Any] = {
                "model": model_string,
            }

            # API key (can be empty for local services)
            if config.get("api_key"):
                litellm_params["api_key"] = config["api_key"]

            if config.get("api_base"):
                litellm_params["api_base"] = config["api_base"]

            if config.get("api_version"):
                litellm_params["api_version"] = config["api_version"]

            if config.get("litellm_params"):
                litellm_params.update(config["litellm_params"])

            # All configs use same alias "auto" for unified routing
            deployment: dict[str, Any] = {
                "model_name": "auto",
                "litellm_params": litellm_params,
            }

            if config.get("rpm"):
                deployment["rpm"] = config["rpm"]

            return deployment

        except Exception as e:
            logger.warning(f"Failed to convert TTS config to deployment: {e}")
            return None

    @classmethod
    def get_router(cls) -> Router | None:
        """Get the initialized router instance."""
        instance = cls.get_instance()
        return instance._router

    @classmethod
    def is_initialized(cls) -> bool:
        """Check if the router has been initialized."""
        instance = cls.get_instance()
        return instance._initialized and instance._router is not None

    @classmethod
    def get_model_count(cls) -> int:
        """Get the number of models in the router."""
        instance = cls.get_instance()
        return len(instance._model_list)

    @classmethod
    def get_first_deployment_params(cls) -> dict[str, Any] | None:
        """Return litellm_params of the first deployment (for direct bypass)."""
        instance = cls.get_instance()
        if not instance._model_list:
            return None
        return instance._model_list[0].get("litellm_params")

    @classmethod
    async def aspeech(
        cls,
        input: str,
        voice: str = "alloy",
        model: str = "auto",
        timeout: int = 600,
        **kwargs,
    ):
        """
        Generate speech using the router for load balancing.

        Args:
            input: Text to convert to speech
            voice: Voice ID
            model: Model alias (default "auto" for router routing)
            timeout: Request timeout in seconds
            **kwargs: Additional provider-specific params

        Returns:
            Speech response from litellm

        Raises:
            ValueError: If router is not initialized
        """
        instance = cls.get_instance()
        if not instance._router:
            raise ValueError(
                "TTS Router not initialized. "
                "Ensure global_llm_config.yaml has global_tts_configs."
            )

        speech_kwargs: dict[str, Any] = {
            "model": model,
            "input": input,
            "voice": voice,
            "timeout": timeout,
        }
        speech_kwargs.update(kwargs)

        return await instance._router.aspeech(**speech_kwargs)


def is_tts_auto_mode(config_id: int | None) -> bool:
    """
    Check if the given config ID represents TTS Auto mode.

    Args:
        config_id: The config ID to check

    Returns:
        True if this is Auto mode, False otherwise
    """
    return config_id == TTS_AUTO_MODE_ID
