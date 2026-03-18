import { atomWithMutation } from "jotai-tanstack-query";
import { toast } from "sonner";
import type {
	CreateEpisodeProfileRequest,
	CreateSpeakerProfileRequest,
	GetEpisodeProfilesResponse,
	GetSpeakerProfilesResponse,
	UpdateEpisodeProfileRequest,
	UpdateSpeakerProfileRequest,
} from "@/contracts/types/podcast-profile.types";
import { podcastProfilesApiService } from "@/lib/apis/podcast-profiles-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { queryClient } from "@/lib/query-client/client";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

// =============================================================================
// Speaker Profile Mutations
// =============================================================================

export const createSpeakerProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["podcast-profiles", "speakers", "create"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: CreateSpeakerProfileRequest) => {
			return podcastProfilesApiService.createSpeakerProfile(request);
		},
		onSuccess: () => {
			toast.success("Speaker profile created");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.podcastProfiles.speakers(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create speaker profile");
		},
	};
});

export const updateSpeakerProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["podcast-profiles", "speakers", "update"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: UpdateSpeakerProfileRequest) => {
			return podcastProfilesApiService.updateSpeakerProfile(request);
		},
		onSuccess: () => {
			toast.success("Speaker profile updated");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.podcastProfiles.speakers(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update speaker profile");
		},
	};
});

export const deleteSpeakerProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["podcast-profiles", "speakers", "delete"],
		enabled: !!searchSpaceId,
		mutationFn: async (id: number) => {
			return podcastProfilesApiService.deleteSpeakerProfile(id);
		},
		onSuccess: (_: unknown, id: number) => {
			toast.success("Speaker profile deleted");
			queryClient.setQueryData(
				cacheKeys.podcastProfiles.speakers(Number(searchSpaceId)),
				(oldData: GetSpeakerProfilesResponse | undefined) => {
					if (!oldData) return oldData;
					return oldData.filter((p) => p.id !== id);
				}
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete speaker profile");
		},
	};
});

// =============================================================================
// Episode Profile Mutations
// =============================================================================

export const createEpisodeProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["podcast-profiles", "episodes", "create"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: CreateEpisodeProfileRequest) => {
			return podcastProfilesApiService.createEpisodeProfile(request);
		},
		onSuccess: () => {
			toast.success("Episode profile created");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.podcastProfiles.episodes(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create episode profile");
		},
	};
});

export const updateEpisodeProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["podcast-profiles", "episodes", "update"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: UpdateEpisodeProfileRequest) => {
			return podcastProfilesApiService.updateEpisodeProfile(request);
		},
		onSuccess: () => {
			toast.success("Episode profile updated");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.podcastProfiles.episodes(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update episode profile");
		},
	};
});

export const deleteEpisodeProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["podcast-profiles", "episodes", "delete"],
		enabled: !!searchSpaceId,
		mutationFn: async (id: number) => {
			return podcastProfilesApiService.deleteEpisodeProfile(id);
		},
		onSuccess: (_: unknown, id: number) => {
			toast.success("Episode profile deleted");
			queryClient.setQueryData(
				cacheKeys.podcastProfiles.episodes(Number(searchSpaceId)),
				(oldData: GetEpisodeProfilesResponse | undefined) => {
					if (!oldData) return oldData;
					return oldData.filter((p) => p.id !== id);
				}
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete episode profile");
		},
	};
});
