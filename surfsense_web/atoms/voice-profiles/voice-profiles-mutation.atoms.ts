import { atomWithMutation } from "jotai-tanstack-query";
import { toast } from "sonner";
import type {
	CreateVoiceProfileRequest,
	GetVoiceProfilesResponse,
	UpdateVoiceProfileRequest,
} from "@/contracts/types/voice-profile.types";
import { voiceProfilesApiService } from "@/lib/apis/voice-profiles-api.service";
import { cacheKeys } from "@/lib/query-client/cache-keys";
import { queryClient } from "@/lib/query-client/client";
import { activeSearchSpaceIdAtom } from "../search-spaces/search-space-query.atoms";

// =============================================================================
// Voice Profile Mutations
// =============================================================================

export const createVoiceProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["voice-profiles", "create"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: CreateVoiceProfileRequest) => {
			return voiceProfilesApiService.createVoiceProfile(request);
		},
		onSuccess: () => {
			toast.success("Voice profile created");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.voiceProfiles.all(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create voice profile");
		},
	};
});

export const createCloneVoiceProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["voice-profiles", "clone"],
		enabled: !!searchSpaceId,
		mutationFn: async (formData: FormData) => {
			return voiceProfilesApiService.createCloneVoiceProfile(formData);
		},
		onSuccess: () => {
			toast.success("Clone voice profile created");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.voiceProfiles.all(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create clone voice profile");
		},
	};
});

export const updateVoiceProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["voice-profiles", "update"],
		enabled: !!searchSpaceId,
		mutationFn: async (request: UpdateVoiceProfileRequest) => {
			return voiceProfilesApiService.updateVoiceProfile(request);
		},
		onSuccess: () => {
			toast.success("Voice profile updated");
			queryClient.invalidateQueries({
				queryKey: cacheKeys.voiceProfiles.all(Number(searchSpaceId)),
			});
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update voice profile");
		},
	};
});

export const deleteVoiceProfileMutationAtom = atomWithMutation((get) => {
	const searchSpaceId = get(activeSearchSpaceIdAtom);

	return {
		mutationKey: ["voice-profiles", "delete"],
		enabled: !!searchSpaceId,
		mutationFn: async (id: number) => {
			return voiceProfilesApiService.deleteVoiceProfile(id);
		},
		onSuccess: (_: unknown, id: number) => {
			toast.success("Voice profile deleted");
			queryClient.setQueryData(
				cacheKeys.voiceProfiles.all(Number(searchSpaceId)),
				(oldData: GetVoiceProfilesResponse | undefined) => {
					if (!oldData) return oldData;
					return oldData.filter((p) => p.id !== id);
				}
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to delete voice profile");
		},
	};
});
