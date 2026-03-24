import {
	type CreateVideoGenConfigRequest,
	createVideoGenConfigRequest,
	createVideoGenConfigResponse,
	deleteVideoGenConfigResponse,
	getGlobalVideoGenConfigsResponse,
	getVideoGenConfigsResponse,
	type UpdateVideoGenConfigRequest,
	updateVideoGenConfigRequest,
	updateVideoGenConfigResponse,
} from "@/contracts/types/new-llm-config.types";
import { ValidationError } from "../error";
import { baseApiService } from "./base-api.service";

class VideoGenConfigApiService {
	/**
	 * Get all global video generation configs (from YAML, negative IDs)
	 */
	getGlobalConfigs = async () => {
		return baseApiService.get(
			`/api/v1/global-video-generation-configs`,
			getGlobalVideoGenConfigsResponse,
		);
	};

	/**
	 * Create a new video generation config for a search space
	 */
	createConfig = async (request: CreateVideoGenConfigRequest) => {
		const parsed = createVideoGenConfigRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		return baseApiService.post(
			`/api/v1/video-generation-configs`,
			createVideoGenConfigResponse,
			{ body: parsed.data },
		);
	};

	/**
	 * Get video generation configs for a search space
	 */
	getConfigs = async (searchSpaceId: number) => {
		const params = new URLSearchParams({
			search_space_id: String(searchSpaceId),
		}).toString();
		return baseApiService.get(
			`/api/v1/video-generation-configs?${params}`,
			getVideoGenConfigsResponse,
		);
	};

	/**
	 * Update an existing video generation config
	 */
	updateConfig = async (request: UpdateVideoGenConfigRequest) => {
		const parsed = updateVideoGenConfigRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		const { id, ...data } = parsed.data;
		return baseApiService.put(
			`/api/v1/video-generation-configs/${id}`,
			updateVideoGenConfigResponse,
			{ body: data },
		);
	};

	/**
	 * Delete a video generation config
	 */
	deleteConfig = async (id: number) => {
		return baseApiService.delete(
			`/api/v1/video-generation-configs/${id}`,
			deleteVideoGenConfigResponse,
		);
	};
}

export const videoGenConfigApiService = new VideoGenConfigApiService();
