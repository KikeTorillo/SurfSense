import {
	type CreateVoiceProfileRequest,
	createVoiceProfileRequest,
	deleteVoiceProfileResponse,
	getVoiceProfilesResponse,
	type UpdateVoiceProfileRequest,
	updateVoiceProfileRequest,
	voiceProfileSchema,
} from "@/contracts/types/voice-profile.types";
import { ValidationError } from "../error";
import { baseApiService } from "./base-api.service";

class VoiceProfilesApiService {
	getVoiceProfiles = async (searchSpaceId: number) => {
		const params = new URLSearchParams({
			search_space_id: String(searchSpaceId),
		}).toString();
		return baseApiService.get(`/api/v1/voice-profiles?${params}`, getVoiceProfilesResponse);
	};

	createVoiceProfile = async (request: CreateVoiceProfileRequest) => {
		const parsed = createVoiceProfileRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		return baseApiService.post(`/api/v1/voice-profiles`, voiceProfileSchema, {
			body: parsed.data,
		});
	};

	createCloneVoiceProfile = async (formData: FormData) => {
		return baseApiService.postFormData(`/api/v1/voice-profiles/clone`, voiceProfileSchema, {
			body: formData,
		});
	};

	updateVoiceProfile = async (request: UpdateVoiceProfileRequest) => {
		const parsed = updateVoiceProfileRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		const { id, data } = parsed.data;
		return baseApiService.put(`/api/v1/voice-profiles/${id}`, voiceProfileSchema, {
			body: data,
		});
	};

	deleteVoiceProfile = async (id: number) => {
		return baseApiService.delete(`/api/v1/voice-profiles/${id}`, deleteVoiceProfileResponse);
	};

	previewVoice = async (profileId: number, text: string) => {
		return baseApiService.postBlob(`/api/v1/voice-profiles/${profileId}/preview`, {
			body: { text },
		});
	};
}

export const voiceProfilesApiService = new VoiceProfilesApiService();
