import {
	type CreateEpisodeProfileRequest,
	type CreateSpeakerProfileRequest,
	createEpisodeProfileRequest,
	createSpeakerProfileRequest,
	deleteEpisodeProfileResponse,
	deleteSpeakerProfileResponse,
	episodeProfileSchema,
	getEpisodeProfilesResponse,
	getSpeakerProfilesResponse,
	speakerProfileSchema,
	type UpdateEpisodeProfileRequest,
	type UpdateSpeakerProfileRequest,
	updateEpisodeProfileRequest,
	updateSpeakerProfileRequest,
} from "@/contracts/types/podcast-profile.types";
import { ValidationError } from "../error";
import { baseApiService } from "./base-api.service";

class PodcastProfilesApiService {
	// =========================================================================
	// Speaker Profiles
	// =========================================================================

	getSpeakerProfiles = async (searchSpaceId: number) => {
		const params = new URLSearchParams({
			search_space_id: String(searchSpaceId),
		}).toString();
		return baseApiService.get(
			`/api/v1/podcast-profiles/speakers?${params}`,
			getSpeakerProfilesResponse
		);
	};

	createSpeakerProfile = async (request: CreateSpeakerProfileRequest) => {
		const parsed = createSpeakerProfileRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		return baseApiService.post(`/api/v1/podcast-profiles/speakers`, speakerProfileSchema, {
			body: parsed.data,
		});
	};

	updateSpeakerProfile = async (request: UpdateSpeakerProfileRequest) => {
		const parsed = updateSpeakerProfileRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		const { id, data } = parsed.data;
		return baseApiService.put(`/api/v1/podcast-profiles/speakers/${id}`, speakerProfileSchema, {
			body: data,
		});
	};

	deleteSpeakerProfile = async (id: number) => {
		return baseApiService.delete(
			`/api/v1/podcast-profiles/speakers/${id}`,
			deleteSpeakerProfileResponse
		);
	};

	// =========================================================================
	// Episode Profiles
	// =========================================================================

	getEpisodeProfiles = async (searchSpaceId: number) => {
		const params = new URLSearchParams({
			search_space_id: String(searchSpaceId),
		}).toString();
		return baseApiService.get(
			`/api/v1/podcast-profiles/episodes?${params}`,
			getEpisodeProfilesResponse
		);
	};

	createEpisodeProfile = async (request: CreateEpisodeProfileRequest) => {
		const parsed = createEpisodeProfileRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		return baseApiService.post(`/api/v1/podcast-profiles/episodes`, episodeProfileSchema, {
			body: parsed.data,
		});
	};

	updateEpisodeProfile = async (request: UpdateEpisodeProfileRequest) => {
		const parsed = updateEpisodeProfileRequest.safeParse(request);
		if (!parsed.success) {
			const msg = parsed.error.issues.map((i) => i.message).join(", ");
			throw new ValidationError(`Invalid request: ${msg}`);
		}
		const { id, data } = parsed.data;
		return baseApiService.put(`/api/v1/podcast-profiles/episodes/${id}`, episodeProfileSchema, {
			body: data,
		});
	};

	deleteEpisodeProfile = async (id: number) => {
		return baseApiService.delete(
			`/api/v1/podcast-profiles/episodes/${id}`,
			deleteEpisodeProfileResponse
		);
	};
}

export const podcastProfilesApiService = new PodcastProfilesApiService();
