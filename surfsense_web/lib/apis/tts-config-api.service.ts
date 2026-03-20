import {
	type CreateTTSConfigRequest,
	createTTSConfigRequest,
	createTTSConfigResponse,
	deleteTTSConfigResponse,
	getGlobalTTSConfigsResponse,
	getTTSConfigsResponse,
	type UpdateTTSConfigRequest,
	updateTTSConfigRequest,
	updateTTSConfigResponse,
} from "@/contracts/types/new-llm-config.types";
import { ValidationError } from "../error";
import { baseApiService } from "./base-api.service";

class TTSConfigApiService {
	/**
	 * Create a new TTS config for a search space
	 */
	createConfig = async (request: CreateTTSConfigRequest) => {
		const parsed = createTTSConfigRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		return baseApiService.post(`/api/v1/tts-configs`, createTTSConfigResponse, {
			body: parsed.data,
		});
	};

	/**
	 * Get TTS configs for a search space
	 */
	getConfigs = async (searchSpaceId: number) => {
		const params = new URLSearchParams({
			search_space_id: String(searchSpaceId),
		}).toString();
		return baseApiService.get(`/api/v1/tts-configs?${params}`, getTTSConfigsResponse);
	};

	/**
	 * Update an existing TTS config
	 */
	updateConfig = async (request: UpdateTTSConfigRequest) => {
		const parsed = updateTTSConfigRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		const { id, data } = parsed.data;
		return baseApiService.put(`/api/v1/tts-configs/${id}`, updateTTSConfigResponse, {
			body: data,
		});
	};

	/**
	 * Delete a TTS config
	 */
	deleteConfig = async (id: number) => {
		return baseApiService.delete(`/api/v1/tts-configs/${id}`, deleteTTSConfigResponse);
	};

	/**
	 * Get all global TTS configs (from YAML, negative IDs)
	 */
	getGlobalConfigs = async () => {
		return baseApiService.get(`/api/v1/global-tts-configs`, getGlobalTTSConfigsResponse);
	};
}

export const ttsConfigApiService = new TTSConfigApiService();
