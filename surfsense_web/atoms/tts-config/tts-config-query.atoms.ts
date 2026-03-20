import { atomWithQuery } from "jotai-tanstack-query";
import { ttsConfigApiService } from "@/lib/apis/tts-config-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

/**
 * Query atom for fetching user-created TTS configs for the active search space
 */
export const ttsConfigsAtom = atomWithQuery((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		queryKey: cacheKeys.ttsConfigs.all(Number(searchSpaceId)),
		enabled: !!searchSpaceId,
		staleTime: 5 * 60 * 1000, // 5 minutes
		queryFn: async () => {
			return ttsConfigApiService.getConfigs(Number(searchSpaceId));
		},
	};
});

/**
 * Query atom for fetching global TTS configs (from YAML, negative IDs)
 */
export const globalTTSConfigsAtom = atomWithQuery(() => {
	return {
		queryKey: cacheKeys.ttsConfigs.global(),
		staleTime: 10 * 60 * 1000, // 10 minutes - global configs rarely change
		queryFn: async () => {
			return ttsConfigApiService.getGlobalConfigs();
		},
	};
});
