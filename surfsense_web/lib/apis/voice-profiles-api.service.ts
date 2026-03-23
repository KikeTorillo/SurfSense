import {
	type CreateVoiceProfileRequest,
	type UpdateVoiceProfileRequest,
	createVoiceProfileRequest,
	getVoiceProfilesResponse,
	updateVoiceProfileRequest,
	voiceProfileSchema,
} from "@/contracts/types/voice-profile.types";
import { getBearerToken } from "../auth-utils";
import { ValidationError } from "../error";
import { baseApiService } from "./base-api.service";

class VoiceProfilesApiService {
	getVoiceProfiles = async (searchSpaceId: number) => {
		const params = new URLSearchParams({
			search_space_id: String(searchSpaceId),
		}).toString();
		return baseApiService.get(
			`/api/v1/voice-profiles?${params}`,
			getVoiceProfilesResponse
		);
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
		const baseUrl = process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL || "";
		const token = getBearerToken() || "";
		const response = await fetch(`${baseUrl}/api/v1/voice-profiles/clone`, {
			method: "POST",
			headers: { "Authorization": `Bearer ${token}` },
			body: formData,
		});
		if (!response.ok) throw new Error("Failed to create clone voice profile");
		const data = await response.json();
		return voiceProfileSchema.parse(data);
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
		return baseApiService.delete(
			`/api/v1/voice-profiles/${id}`,
			voiceProfileSchema
		);
	};

	previewVoice = async (profileId: number, text: string) => {
		const baseUrl = process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL || "";
		const token = getBearerToken() || "";
		const response = await fetch(`${baseUrl}/api/v1/voice-profiles/${profileId}/preview`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${token}`,
			},
			body: JSON.stringify({ text }),
		});
		if (!response.ok) throw new Error("Failed to generate preview");
		return response.blob();
	};
}

export const voiceProfilesApiService = new VoiceProfilesApiService();
