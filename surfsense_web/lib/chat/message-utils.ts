import type { ThreadMessageLike } from "@assistant-ui/react";
import type { MessageRecord } from "./thread-persistence";

/**
 * Convert backend message to assistant-ui ThreadMessageLike format
 * Filters out 'thinking-steps' part as it's handled separately via messageThinkingSteps
 */
export function convertToThreadMessage(msg: MessageRecord): ThreadMessageLike {
	let content: ThreadMessageLike["content"];

	if (typeof msg.content === "string") {
		content = [{ type: "text", text: msg.content }];
	} else if (Array.isArray(msg.content)) {
		// Extract image attachments before filtering
		const imageParts: Array<{ type: "image"; image: string }> = [];
		for (const part of msg.content) {
			if (
				typeof part === "object" &&
				part !== null &&
				"type" in part &&
				(part as { type: string }).type === "attachments" &&
				"images" in part &&
				Array.isArray((part as { images: unknown[] }).images)
			) {
				for (const img of (part as { images: Array<{ dataUrl: string; name: string }> }).images) {
					imageParts.push({ type: "image", image: img.dataUrl });
				}
			}
		}

		// Filter out custom metadata parts - they're handled separately
		const filteredContent = msg.content.filter((part: unknown) => {
			if (typeof part !== "object" || part === null || !("type" in part)) return true;
			const partType = (part as { type: string }).type;
			// Filter out metadata parts not directly renderable by assistant-ui
			return (
				partType !== "thinking-steps" &&
				partType !== "mentioned-documents" &&
				partType !== "attachments"
			);
		});

		// Combine renderable content + restored image parts
		const combined = [...filteredContent, ...imageParts];
		content =
			combined.length > 0
				? (combined as ThreadMessageLike["content"])
				: [{ type: "text", text: "" }];
	} else {
		content = [{ type: "text", text: String(msg.content) }];
	}

	// Build metadata.custom for author display in shared chats
	const metadata = msg.author_id
		? {
				custom: {
					author: {
						displayName: msg.author_display_name ?? null,
						avatarUrl: msg.author_avatar_url ?? null,
					},
				},
			}
		: undefined;

	return {
		id: `msg-${msg.id}`,
		role: msg.role,
		content,
		createdAt: new Date(msg.created_at),
		metadata,
	};
}
