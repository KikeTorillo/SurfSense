import { atomWithMutation } from "jotai-tanstack-query";
import { toast } from "sonner";
import type {
	CreateTTSConfigRequest,
	GetTTSConfigsResponse,
	UpdateTTSConfigRequest,
	UpdateTTSConfigResponse,
} from "@/contracts/types/new-llm-config.types";
import { ttsConfigApiService } from "@/lib/apis/tts-config-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { queryClient } from "@/lib/query-client/client";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

/**
 * Mutation atom for creating a new TTSConfig
 */
export const createTTSConfigMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["tts-configs", "create"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: CreateTTSConfigRequest) => {
			return ttsConfigApiService.createConfig(request);
		},
		onSuccess: () => {
			toast.success("TTS configuration created");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.ttsConfigs.all(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create TTS configuration");
		},
	};
});

/**
 * Mutation atom for updating an existing TTSConfig
 */
export const updateTTSConfigMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["tts-configs", "update"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: UpdateTTSConfigRequest) => {
			return ttsConfigApiService.updateConfig(request);
		},
		onSuccess: (_: UpdateTTSConfigResponse, request: UpdateTTSConfigRequest) => {
			toast.success("TTS configuration updated");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.ttsConfigs.all(Number(searchSpaceId)),
			});
			queryClient.invalidateQueries({
				queryKey: cacheKeys.ttsConfigs.byId(request.id),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update TTS configuration");
		},
	};
});

/**
 * Mutation atom for deleting a TTSConfig
 */
export const deleteTTSConfigMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["tts-configs", "delete"],
		enabled: !!searchSpaceId,
		mutationFn: async (id: number) => {
			return ttsConfigApiService.deleteConfig(id);
		},
		onSuccess: (_, id: number) => {
			toast.success("TTS configuration deleted");
			queryClient.setQueryData(
				cacheKeys.ttsConfigs.all(Number(searchSpaceId)),
				(oldData: GetTTSConfigsResponse | undefined) => {
					if (!oldData) return oldData;
					return oldData.filter((config) => config.id !== id);
				}
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete TTS configuration");
		},
	};
});
