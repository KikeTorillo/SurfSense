import { z } from "zod";

// =============================================================================
// Voice Type Enum
// =============================================================================

export const voiceTypeEnum = z.enum(["preset", "design", "clone"]);

// =============================================================================
// Voice Profile CRUD
// =============================================================================

export const voiceProfileSchema = z.object({
	id: z.number(),
	name: z.string(),
	search_space_id: z.number(),
	voice_type: voiceTypeEnum,
	preset_voice_id: z.string().nullable(),
	design_instructions: z.string().nullable(),
	clone_profile_id: z.string().nullable(),
	clone_ref_text: z.string().nullable(),
	style_instructions: z.string().nullable(),
	language: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string().nullable(),
});

export const createVoiceProfileRequest = z.object({
	name: z.string().min(1),
	search_space_id: z.number(),
	voice_type: voiceTypeEnum,
	preset_voice_id: z.string().optional(),
	design_instructions: z.string().optional(),
	clone_ref_text: z.string().optional(),
	style_instructions: z.string().optional(),
	language: z.string().optional(),
});

export const updateVoiceProfileRequest = z.object({
	id: z.number(),
	data: z.object({
		name: z.string().optional(),
		style_instructions: z.string().optional(),
		language: z.string().optional(),
		design_instructions: z.string().optional(),
		clone_ref_text: z.string().optional(),
	}),
});

export const getVoiceProfilesResponse = z.array(voiceProfileSchema);

export const deleteVoiceProfileResponse = z.object({
	status: z.string(),
	id: z.number(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type VoiceType = z.infer<typeof voiceTypeEnum>;
export type VoiceProfile = z.infer<typeof voiceProfileSchema>;
export type CreateVoiceProfileRequest = z.infer<typeof createVoiceProfileRequest>;
export type UpdateVoiceProfileRequest = z.infer<typeof updateVoiceProfileRequest>;
export type GetVoiceProfilesResponse = z.infer<typeof getVoiceProfilesResponse>;
export type DeleteVoiceProfileResponse = z.infer<typeof deleteVoiceProfileResponse>;
