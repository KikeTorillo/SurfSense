import { atomWithQuery } from "jotai-tanstack-query";
import { videoGenConfigApiService } from "@/lib/apis/video-gen-config-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

/**
 * Query atom for fetching user-created video gen configs for the active search space
 */
export const videoGenConfigsAtom = atomWithQuery((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		queryKey: cacheKeys.videoGenConfigs.all(Number(searchSpaceId)),
		enabled: !!searchSpaceId,
		staleTime: 5 * 60 * 1000, // 5 minutes
		queryFn: async () => {
			return videoGenConfigApiService.getConfigs(Number(searchSpaceId));
		},
	};
});

/**
 * Query atom for fetching global video gen configs (from YAML, negative IDs)
 */
export const globalVideoGenConfigsAtom = atomWithQuery(() => {
	return {
		queryKey: cacheKeys.videoGenConfigs.global(),
		staleTime: 10 * 60 * 1000, // 10 minutes - global configs rarely change
		queryFn: async () => {
			return videoGenConfigApiService.getGlobalConfigs();
		},
	};
});
