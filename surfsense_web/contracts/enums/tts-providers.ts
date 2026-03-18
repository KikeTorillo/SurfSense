export interface TTSProvider {
	value: string;
	label: string;
	description: string;
}

export const TTS_PROVIDERS: TTSProvider[] = [
	{
		value: "kokoro",
		label: "Kokoro (Local)",
		description: "Local TTS via Kokoro",
	},
	{
		value: "openai",
		label: "OpenAI",
		description: "OpenAI TTS (tts-1, tts-1-hd)",
	},
	{
		value: "azure",
		label: "Azure",
		description: "Azure TTS (tts-1)",
	},
	{
		value: "vertex_ai",
		label: "Google Vertex AI",
		description: "Vertex AI TTS",
	},
];

export interface VoiceSuggestion {
	value: string;
	label: string;
}

export const VOICE_SUGGESTIONS: Record<string, VoiceSuggestion[]> = {
	kokoro: [
		{ value: "am_adam", label: "Adam (Male)" },
		{ value: "af_bella", label: "Bella (Female)" },
		{ value: "af_heart", label: "Heart (Female)" },
		{ value: "af_sky", label: "Sky (Female)" },
		{ value: "bf_emma", label: "Emma (Female, British)" },
		{ value: "bm_george", label: "George (Male, British)" },
		{ value: "am_michael", label: "Michael (Male)" },
		{ value: "af_nicole", label: "Nicole (Female)" },
	],
	openai: [
		{ value: "alloy", label: "Alloy" },
		{ value: "echo", label: "Echo" },
		{ value: "fable", label: "Fable" },
		{ value: "onyx", label: "Onyx" },
		{ value: "nova", label: "Nova" },
		{ value: "shimmer", label: "Shimmer" },
	],
	azure: [
		{ value: "alloy", label: "Alloy" },
		{ value: "echo", label: "Echo" },
		{ value: "fable", label: "Fable" },
		{ value: "onyx", label: "Onyx" },
		{ value: "nova", label: "Nova" },
		{ value: "shimmer", label: "Shimmer" },
	],
	vertex_ai: [],
};

export function getVoicesByProvider(provider: string): VoiceSuggestion[] {
	return VOICE_SUGGESTIONS[provider] || [];
}

export interface Language {
	value: string;
	label: string;
}

export const LANGUAGES: Language[] = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "pt", label: "Portuguese" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "nl", label: "Dutch" },
	{ value: "pl", label: "Polish" },
	{ value: "ru", label: "Russian" },
	{ value: "ja", label: "Japanese" },
	{ value: "ko", label: "Korean" },
	{ value: "zh", label: "Chinese" },
	{ value: "ar", label: "Arabic" },
	{ value: "hi", label: "Hindi" },
	{ value: "tr", label: "Turkish" },
	{ value: "sv", label: "Swedish" },
	{ value: "da", label: "Danish" },
	{ value: "fi", label: "Finnish" },
	{ value: "no", label: "Norwegian" },
	{ value: "uk", label: "Ukrainian" },
];
