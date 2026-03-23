import { atomWithQuery } from "jotai-tanstack-query";
import { voiceProfilesApiService } from "@/lib/apis/voice-profiles-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

/**
 * Query atom for fetching voice profiles for the active search space
 */
export const voiceProfilesAtom = atomWithQuery((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		queryKey: cacheKeys.voiceProfiles.all(Number(searchSpaceId)),
		enabled: !!searchSpaceId,
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			return voiceProfilesApiService.getVoiceProfiles(Number(searchSpaceId));
		},
	};
});
