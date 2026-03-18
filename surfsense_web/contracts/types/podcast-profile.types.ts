import { z } from "zod";

// =============================================================================
// Speaker (nested within SpeakerProfile)
// =============================================================================

export const speakerSchema = z.object({
	name: z.string().min(1),
	voice_id: z.string().min(1),
	backstory: z.string(),
	personality: z.string(),
	tts_provider: z.string().nullable().optional(),
	tts_model: z.string().nullable().optional(),
	tts_config: z.record(z.string(), z.any()).nullable().optional(),
});

// =============================================================================
// Speaker Profile CRUD
// =============================================================================

export const speakerProfileSchema = z.object({
	id: z.number(),
	name: z.string(),
	search_space_id: z.number(),
	tts_provider: z.string().nullable().optional(),
	tts_model: z.string().nullable().optional(),
	speakers: z.array(speakerSchema),
	created_at: z.string(),
	updated_at: z.string().nullable().optional(),
});

export const createSpeakerProfileRequest = z.object({
	name: z.string().min(1),
	search_space_id: z.number(),
	tts_provider: z.string(),
	tts_model: z.string(),
	speakers: z.array(speakerSchema).min(1).max(4),
});

export const updateSpeakerProfileRequest = z.object({
	id: z.number(),
	data: z.object({
		name: z.string().optional(),
		tts_provider: z.string().optional(),
		tts_model: z.string().optional(),
		speakers: z.array(speakerSchema).min(1).max(4).optional(),
	}),
});

export const getSpeakerProfilesResponse = z.array(speakerProfileSchema);

export const deleteSpeakerProfileResponse = z.object({
	message: z.string(),
});

// =============================================================================
// Episode Profile CRUD
// =============================================================================

export const episodeProfileSchema = z.object({
	id: z.number(),
	name: z.string(),
	search_space_id: z.number(),
	speaker_profile_id: z.number().nullable().optional(),
	num_segments: z.number(),
	language: z.string(),
	default_briefing: z.string().nullable().optional(),
	outline_prompt: z.string().nullable().optional(),
	transcript_prompt: z.string().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string().nullable().optional(),
});

export const createEpisodeProfileRequest = z.object({
	name: z.string().min(1),
	search_space_id: z.number(),
	speaker_profile_id: z.number().nullable().optional(),
	num_segments: z.number().min(1).max(10).default(3),
	language: z.string().default("en"),
	default_briefing: z.string().nullable().optional(),
	outline_prompt: z.string().nullable().optional(),
	transcript_prompt: z.string().nullable().optional(),
});

export const updateEpisodeProfileRequest = z.object({
	id: z.number(),
	data: z.object({
		name: z.string().optional(),
		speaker_profile_id: z.number().nullable().optional(),
		num_segments: z.number().min(1).max(10).optional(),
		language: z.string().optional(),
		default_briefing: z.string().nullable().optional(),
		outline_prompt: z.string().nullable().optional(),
		transcript_prompt: z.string().nullable().optional(),
	}),
});

export const getEpisodeProfilesResponse = z.array(episodeProfileSchema);

export const deleteEpisodeProfileResponse = z.object({
	message: z.string(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Speaker = z.infer<typeof speakerSchema>;
export type SpeakerProfile = z.infer<typeof speakerProfileSchema>;
export type CreateSpeakerProfileRequest = z.infer<typeof createSpeakerProfileRequest>;
export type UpdateSpeakerProfileRequest = z.infer<typeof updateSpeakerProfileRequest>;
export type GetSpeakerProfilesResponse = z.infer<typeof getSpeakerProfilesResponse>;
export type DeleteSpeakerProfileResponse = z.infer<typeof deleteSpeakerProfileResponse>;
export type EpisodeProfile = z.infer<typeof episodeProfileSchema>;
export type CreateEpisodeProfileRequest = z.infer<typeof createEpisodeProfileRequest>;
export type UpdateEpisodeProfileRequest = z.infer<typeof updateEpisodeProfileRequest>;
export type GetEpisodeProfilesResponse = z.infer<typeof getEpisodeProfilesResponse>;
export type DeleteEpisodeProfileResponse = z.infer<typeof deleteEpisodeProfileResponse>;
