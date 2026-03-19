export interface PodcastTemplateSpeaker {
	name: string;
	voice_id: string;
	backstory: string;
	personality: string;
}

export interface PodcastTemplate {
	key: string;
	name: string;
	description: string;
	speakerProfile: {
		name: string;
		tts_provider: string;
		tts_model: string;
		speakers: PodcastTemplateSpeaker[];
	};
	episodeProfile: {
		name: string;
		num_segments: number;
		language: string;
		default_briefing: string;
	};
}

export const PODCAST_TEMPLATES: PodcastTemplate[] = [
	{
		key: "academic-discussion",
		name: "Academic Discussion",
		description: "A professor and student explore a topic in depth with educational dialogue.",
		speakerProfile: {
			name: "Academic Discussion Speakers",
			tts_provider: "kokoro",
			tts_model: "kokoro",
			speakers: [
				{
					name: "Professor",
					voice_id: "af_heart",
					backstory:
						"An experienced academic with deep expertise, known for clear explanations and thought-provoking questions.",
					personality:
						"Authoritative yet approachable. Uses analogies and examples to explain complex concepts. Encourages critical thinking.",
				},
				{
					name: "Student",
					voice_id: "am_michael",
					backstory:
						"A curious graduate student eager to understand the topic from multiple angles.",
					personality:
						"Inquisitive and engaged. Asks follow-up questions and connects ideas to practical applications.",
				},
			],
		},
		episodeProfile: {
			name: "Academic Discussion Format",
			num_segments: 4,
			language: "en",
			default_briefing:
				"Create an educational discussion that breaks down the topic into understandable concepts. The professor should guide the conversation while the student asks insightful questions.",
		},
	},
	{
		key: "interview",
		name: "Interview",
		description:
			"A structured interview format with a host asking questions to a knowledgeable guest.",
		speakerProfile: {
			name: "Interview Speakers",
			tts_provider: "kokoro",
			tts_model: "kokoro",
			speakers: [
				{
					name: "Interviewer",
					voice_id: "af_heart",
					backstory:
						"A skilled journalist who asks probing questions and keeps the conversation focused.",
					personality:
						"Professional and curious. Asks open-ended questions and follows up on interesting points.",
				},
				{
					name: "Guest",
					voice_id: "am_michael",
					backstory:
						"A subject matter expert with firsthand experience and unique insights on the topic.",
					personality:
						"Knowledgeable and articulate. Shares personal anecdotes and provides detailed explanations.",
				},
			],
		},
		episodeProfile: {
			name: "Interview Format",
			num_segments: 3,
			language: "en",
			default_briefing:
				"Conduct a structured interview that covers the key aspects of the topic. The interviewer should guide the conversation while letting the guest share their expertise.",
		},
	},
	{
		key: "debate",
		name: "Debate",
		description: "A moderated debate with two speakers presenting opposing viewpoints on a topic.",
		speakerProfile: {
			name: "Debate Speakers",
			tts_provider: "kokoro",
			tts_model: "kokoro",
			speakers: [
				{
					name: "Moderator",
					voice_id: "af_heart",
					backstory:
						"An impartial moderator who ensures fair discussion and asks clarifying questions.",
					personality:
						"Neutral and fair. Keeps the debate structured and ensures both sides are heard equally.",
				},
				{
					name: "Advocate",
					voice_id: "am_michael",
					backstory:
						"A passionate supporter of the main position with strong arguments and evidence.",
					personality:
						"Persuasive and well-prepared. Presents clear arguments backed by data and examples.",
				},
				{
					name: "Challenger",
					voice_id: "bf_emma",
					backstory:
						"A thoughtful critic who presents counterarguments and alternative perspectives.",
					personality:
						"Analytical and respectful. Challenges assumptions while acknowledging valid points from the other side.",
				},
			],
		},
		episodeProfile: {
			name: "Debate Format",
			num_segments: 5,
			language: "en",
			default_briefing:
				"Create a balanced debate that explores multiple perspectives on the topic. The moderator should ensure fair time for both sides and summarize key points.",
		},
	},
	{
		key: "panel",
		name: "Panel Discussion",
		description: "A host-led panel with multiple experts sharing diverse perspectives on a topic.",
		speakerProfile: {
			name: "Panel Discussion Speakers",
			tts_provider: "kokoro",
			tts_model: "kokoro",
			speakers: [
				{
					name: "Host",
					voice_id: "af_heart",
					backstory:
						"An engaging host who facilitates discussion and draws out insights from each panelist.",
					personality:
						"Charismatic and organized. Connects different perspectives and keeps the discussion moving.",
				},
				{
					name: "Expert A",
					voice_id: "am_michael",
					backstory:
						"A technical expert with deep knowledge of the practical aspects of the topic.",
					personality:
						"Detail-oriented and methodical. Provides concrete examples and technical insights.",
				},
				{
					name: "Expert B",
					voice_id: "bf_emma",
					backstory: "A strategic thinker who sees the bigger picture and long-term implications.",
					personality:
						"Visionary and thoughtful. Connects the topic to broader trends and future possibilities.",
				},
				{
					name: "Expert C",
					voice_id: "bm_george",
					backstory:
						"A practitioner with real-world experience implementing solutions related to the topic.",
					personality:
						"Practical and grounded. Shares lessons learned and actionable advice from experience.",
				},
			],
		},
		episodeProfile: {
			name: "Panel Discussion Format",
			num_segments: 6,
			language: "en",
			default_briefing:
				"Create a dynamic panel discussion where each expert contributes their unique perspective. The host should ensure all panelists participate and the discussion covers multiple angles of the topic.",
		},
	},
];
