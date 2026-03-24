import { atomWithMutation } from "jotai-tanstack-query";
import { toast } from "sonner";
import type {
	CreateVideoGenConfigRequest,
	GetVideoGenConfigsResponse,
	UpdateVideoGenConfigRequest,
	UpdateVideoGenConfigResponse,
} from "@/contracts/types/new-llm-config.types";
import { videoGenConfigApiService } from "@/lib/apis/video-gen-config-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { queryClient } from "@/lib/query-client/client";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

/**
 * Mutation atom for creating a new VideoGenerationConfig
 */
export const createVideoGenConfigMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["video-gen-configs", "create"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: CreateVideoGenConfigRequest) => {
			return videoGenConfigApiService.createConfig(request);
		},
		onSuccess: () => {
			toast.success("Video model configuration created");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.videoGenConfigs.all(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create video model configuration");
		},
	};
});

/**
 * Mutation atom for updating an existing VideoGenerationConfig
 */
export const updateVideoGenConfigMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["video-gen-configs", "update"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: UpdateVideoGenConfigRequest) => {
			return videoGenConfigApiService.updateConfig(request);
		},
		onSuccess: (
			_: UpdateVideoGenConfigResponse,
			request: UpdateVideoGenConfigRequest,
		) => {
			toast.success("Video model configuration updated");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.videoGenConfigs.all(Number(searchSpaceId)),
			});
			queryClient.invalidateQueries({
				queryKey: cacheKeys.videoGenConfigs.byId(request.id),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update video model configuration");
		},
	};
});

/**
 * Mutation atom for deleting a VideoGenerationConfig
 */
export const deleteVideoGenConfigMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["video-gen-configs", "delete"],
		enabled: !!searchSpaceId,
		mutationFn: async (id: number) => {
			return videoGenConfigApiService.deleteConfig(id);
		},
		onSuccess: (_: unknown, id: number) => {
			toast.success("Video model configuration deleted");
			queryClient.setQueryData(
				cacheKeys.videoGenConfigs.all(Number(searchSpaceId)),
				(oldData: GetVideoGenConfigsResponse | undefined) => {
					if (!oldData) return oldData;
					return oldData.filter((config) => config.id !== id);
				},
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete video model configuration");
		},
	};
});
