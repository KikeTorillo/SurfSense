"use client";

import { useCallback, useRef, useState } from "react";
import { z } from "zod";

// =============================================================================
// Schema
// =============================================================================

export const SerializableVideoSchema = z.object({
	id: z.string().optional(),
	assetId: z.string().optional(),
	src: z.string(),
	alt: z.string().optional().default("Video"),
	title: z.string().nullish(),
	description: z.string().nullish(),
	domain: z.string().nullish(),
});

export type SerializableVideo = z.infer<typeof SerializableVideoSchema>;

export function parseSerializableVideo(data: unknown): SerializableVideo {
	const parsed = SerializableVideoSchema.safeParse(data);
	if (parsed.success) return parsed.data;
	throw new Error("Invalid video data");
}

// =============================================================================
// Loading
// =============================================================================

export function VideoLoading({ title }: { title?: string }) {
	return (
		<div className="overflow-hidden rounded-xl border bg-muted/30 max-w-[640px]">
			<div className="aspect-video animate-pulse bg-muted" />
			{title ? (
				<div className="p-3">
					<p className="text-muted-foreground text-sm">{title}</p>
				</div>
			) : null}
		</div>
	);
}

// =============================================================================
// Error Boundary
// =============================================================================

export function VideoErrorBoundary({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}

// =============================================================================
// Video Component
// =============================================================================

interface VideoProps extends SerializableVideo {
	maxWidth?: string;
}

export function Video({
	src,
	alt,
	title,
	description,
	domain,
	maxWidth = "640px",
}: VideoProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [hasError, setHasError] = useState(false);

	const handleError = useCallback(() => {
		setHasError(true);
	}, []);

	if (hasError) {
		return (
			<div
				className="overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-4"
				style={{ maxWidth }}
			>
				<p className="text-destructive text-sm font-medium">
					Failed to load video
				</p>
				<p className="text-muted-foreground text-xs mt-1 truncate">{src}</p>
			</div>
		);
	}

	return (
		<div
			className="group relative overflow-hidden rounded-xl border bg-background"
			style={{ maxWidth }}
		>
			<video
				ref={videoRef}
				src={src}
				controls
				autoPlay
				muted
				loop
				playsInline
				preload="auto"
				onError={handleError}
				className="w-full aspect-video"
			>
				<track kind="descriptions" label={alt || "Video"} />
			</video>

			{(title || description || domain) ? (
				<div className="p-3 border-t">
					{domain ? (
						<p className="text-muted-foreground text-xs mb-1">{domain}</p>
					) : null}
					{title ? (
						<p className="font-medium text-sm">{title}</p>
					) : null}
					{description ? (
						<p className="text-muted-foreground text-xs mt-0.5">
							{description}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
