"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { AlertCircleIcon, VideoIcon } from "lucide-react";
import { z } from "zod";
import {
	Video,
	VideoErrorBoundary,
	VideoLoading,
	parseSerializableVideo,
} from "@/components/tool-ui/video";

// ============================================================================
// Zod Schemas
// ============================================================================

const DisplayVideoArgsSchema = z.object({
	src: z.string(),
	alt: z.string().nullish(),
	title: z.string().nullish(),
	description: z.string().nullish(),
});

const DisplayVideoResultSchema = z.object({
	id: z.string(),
	assetId: z.string(),
	src: z.string(),
	alt: z.string().nullish(),
	title: z.string().nullish(),
	description: z.string().nullish(),
	domain: z.string().nullish(),
	error: z.string().nullish(),
});

// ============================================================================
// Types
// ============================================================================

type DisplayVideoArgs = z.infer<typeof DisplayVideoArgsSchema>;
type DisplayVideoResult = z.infer<typeof DisplayVideoResultSchema>;

function VideoErrorState({ src, error }: { src: string; error: string }) {
	return (
		<div className="my-4 overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-4 max-w-md">
			<div className="flex items-center gap-4">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
					<AlertCircleIcon className="size-6 text-destructive" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-medium text-destructive text-sm">
						Failed to display video
					</p>
					<p className="text-muted-foreground text-xs mt-0.5 truncate">
						{src}
					</p>
					<p className="text-muted-foreground text-xs mt-1">{error}</p>
				</div>
			</div>
		</div>
	);
}

function VideoCancelledState({ src }: { src: string }) {
	return (
		<div className="my-4 rounded-xl border border-muted p-4 text-muted-foreground max-w-md">
			<p className="flex items-center gap-2">
				<VideoIcon className="size-4" />
				<span className="line-through truncate">Video: {src}</span>
			</p>
		</div>
	);
}

function ParsedVideo({ result }: { result: unknown }) {
	const video = parseSerializableVideo(result);
	return <Video {...video} maxWidth="640px" />;
}

/**
 * Display Video Tool UI Component
 *
 * Registered with assistant-ui to render a video player
 * when the display_video tool is called by the agent.
 */
export const DisplayVideoToolUI = makeAssistantToolUI<
	DisplayVideoArgs,
	DisplayVideoResult
>({
	toolName: "display_video",
	render: function DisplayVideoUI({ args, result, status }) {
		const src = args.src || "Unknown";

		// Loading state
		if (status.type === "running" || status.type === "requires-action") {
			return (
				<div className="my-4">
					<VideoLoading title="Generating video... this may take about a minute" />
				</div>
			);
		}

		// Incomplete/cancelled state
		if (status.type === "incomplete") {
			if (status.reason === "cancelled") {
				return <VideoCancelledState src={src} />;
			}
			if (status.reason === "error") {
				return (
					<VideoErrorState
						src={src}
						error={
							typeof status.error === "string"
								? status.error
								: "An error occurred"
						}
					/>
				);
			}
		}

		// No result yet
		if (!result) {
			return (
				<div className="my-4">
					<VideoLoading title="Preparing video..." />
				</div>
			);
		}

		// Error result from the tool
		if (result.error) {
			return <VideoErrorState src={src} error={result.error} />;
		}

		// Success - render the video
		return (
			<div className="my-4">
				<VideoErrorBoundary>
					<ParsedVideo result={result} />
				</VideoErrorBoundary>
			</div>
		);
	},
});

export {
	DisplayVideoArgsSchema,
	DisplayVideoResultSchema,
	type DisplayVideoArgs,
	type DisplayVideoResult,
};
