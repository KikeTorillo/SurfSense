"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { AlertCircleIcon, GlobeIcon, LoaderIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { z } from "zod";

// ============================================================================
// Zod Schemas
// ============================================================================

const BrowseWebArgsSchema = z.object({
	task: z.string(),
	max_steps: z.number().nullish(),
});

const BrowseWebResultSchema = z.object({
	status: z.enum(["success", "partial", "error", "timeout"]),
	extracted_content: z.string().nullish(),
	content_preview: z.string().nullish(),
	urls_visited: z.array(z.string()).nullish(),
	actions_taken: z.number().nullish(),
	duration_seconds: z.number().nullish(),
	error: z.string().nullish(),
	errors: z.array(z.string()).nullish(),
});

// ============================================================================
// Types
// ============================================================================

type BrowseWebArgs = z.infer<typeof BrowseWebArgsSchema>;
type BrowseWebResult = z.infer<typeof BrowseWebResultSchema>;

// ============================================================================
// Sub-components
// ============================================================================

function BrowseErrorState({ task, error }: { task: string; error: string }) {
	const t = useTranslations("browseWebTool");
	return (
		<div className="my-4 overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-4 max-w-md">
			<div className="flex items-center gap-4">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
					<AlertCircleIcon className="size-6 text-destructive" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-medium text-destructive text-sm">{t("errorTitle")}</p>
					<p className="text-muted-foreground text-xs mt-0.5 truncate">{task}</p>
					<p className="text-muted-foreground text-xs mt-1">{error}</p>
				</div>
			</div>
		</div>
	);
}

function BrowseLoadingState({ task }: { task: string }) {
	const t = useTranslations("browseWebTool");
	return (
		<div className="my-4 overflow-hidden rounded-xl border border-border bg-muted/30 p-4 max-w-md">
			<div className="flex items-center gap-4">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
					<LoaderIcon className="size-6 text-primary animate-spin" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-medium text-sm">{t("loading")}</p>
					<p className="text-muted-foreground text-xs mt-0.5 truncate">{task}</p>
				</div>
			</div>
		</div>
	);
}

function BrowseSuccessState({ result }: { result: BrowseWebResult }) {
	const t = useTranslations("browseWebTool");
	const urls = result.urls_visited ?? [];
	const actions = result.actions_taken ?? 0;
	const duration = result.duration_seconds ?? 0;

	return (
		<div className="my-4 overflow-hidden rounded-xl border border-border bg-muted/30 p-4 max-w-md">
			<div className="flex items-center gap-4">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
					<GlobeIcon className="size-6 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-medium text-sm">{t("successTitle")}</p>
					<p className="text-muted-foreground text-xs mt-0.5">
						{t("stats", {
							pages: urls.length,
							actions,
							duration,
						})}
					</p>
					{urls.length > 0 && (
						<div className="mt-2 flex flex-col gap-1">
							{urls.slice(0, 3).map((url) => (
								<a
									key={url}
									href={url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-primary hover:underline truncate block"
								>
									{url}
								</a>
							))}
							{urls.length > 3 && (
								<p className="text-xs text-muted-foreground">
									{t("morePages", { count: urls.length - 3 })}
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Tool UI
// ============================================================================

export const BrowseWebToolUI = makeAssistantToolUI<BrowseWebArgs, BrowseWebResult>({
	toolName: "browse_web",
	render: function BrowseWebUI({ args, result, status }) {
		const task = args.task || "Browsing...";

		// Loading state
		if (status.type === "running" || status.type === "requires-action") {
			return <BrowseLoadingState task={task} />;
		}

		// Incomplete/cancelled
		if (status.type === "incomplete") {
			if (status.reason === "error") {
				return (
					<BrowseErrorState
						task={task}
						error={typeof status.error === "string" ? status.error : "An error occurred"}
					/>
				);
			}
			return null;
		}

		// No result
		if (!result) {
			return <BrowseLoadingState task={task} />;
		}

		// Error/timeout result
		if (result.status === "error" || result.status === "timeout") {
			return <BrowseErrorState task={task} error={result.error || "Browser task failed"} />;
		}

		// Success
		return <BrowseSuccessState result={result} />;
	},
});

export { type BrowseWebArgs, BrowseWebArgsSchema, type BrowseWebResult, BrowseWebResultSchema };
