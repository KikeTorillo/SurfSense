import { atomWithQuery } from "jotai-tanstack-query";
import { podcastProfilesApiService } from "@/lib/apis/podcast-profiles-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

/**
 * Query atom for fetching speaker profiles for the active search space
 */
export const speakerProfilesAtom = atomWithQuery((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		queryKey: cacheKeys.podcastProfiles.speakers(Number(searchSpaceId)),
		enabled: !!searchSpaceId,
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			return podcastProfilesApiService.getSpeakerProfiles(Number(searchSpaceId));
		},
	};
});

/**
 * Query atom for fetching episode profiles for the active search space
 */
export const episodeProfilesAtom = atomWithQuery((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		queryKey: cacheKeys.podcastProfiles.episodes(Number(searchSpaceId)),
		enabled: !!searchSpaceId,
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			return podcastProfilesApiService.getEpisodeProfiles(Number(searchSpaceId));
		},
	};
});
