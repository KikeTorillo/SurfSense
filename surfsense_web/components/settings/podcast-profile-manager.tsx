"use client";

import { useAtomValue } from "jotai";
import {
	AlertCircle,
	Copy,
	Edit3,
	Info,
	LayoutTemplate,
	Mic,
	Plus,
	RefreshCw,
	Trash2,
	Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { myAccessAtom } from "@/atoms/members/members-query.atoms";
import {
	createEpisodeProfileMutationAtom,
	createSpeakerProfileMutationAtom,
	deleteEpisodeProfileMutationAtom,
	deleteSpeakerProfileMutationAtom,
	duplicateEpisodeProfileMutationAtom,
	duplicateSpeakerProfileMutationAtom,
	updateEpisodeProfileMutationAtom,
	updateSpeakerProfileMutationAtom,
} from "@/atoms/podcast-profiles/podcast-profiles-mutation.atoms";
import {
	episodeProfilesAtom,
	speakerProfilesAtom,
} from "@/atoms/podcast-profiles/podcast-profiles-query.atoms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PODCAST_TEMPLATES, type PodcastTemplate } from "@/contracts/enums/podcast-templates";
import { getVoicesByProvider, LANGUAGES, TTS_PROVIDERS } from "@/contracts/enums/tts-providers";
import type {
	EpisodeProfile,
	Speaker,
	SpeakerProfile,
} from "@/contracts/types/podcast-profile.types";
import { cn } from "@/lib/utils";

interface PodcastProfileManagerProps {
	searchSpaceId: number;
}

const container = {
	hidden: { opacity: 0 },
	show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0 },
};

const DEFAULT_SPEAKER: Speaker = {
	name: "",
	voice_id: "",
	backstory: "",
	personality: "",
};

// =============================================================================
// Speaker Profile Form State
// =============================================================================

interface SpeakerProfileFormData {
	name: string;
	tts_provider: string;
	tts_model: string;
	speakers: Speaker[];
}

const EMPTY_SPEAKER_FORM: SpeakerProfileFormData = {
	name: "",
	tts_provider: "",
	tts_model: "",
	speakers: [{ ...DEFAULT_SPEAKER }],
};

// =============================================================================
// Episode Profile Form State
// =============================================================================

interface EpisodeProfileFormData {
	name: string;
	speaker_profile_id: number | null;
	num_segments: number;
	language: string;
	default_briefing: string;
	outline_prompt: string;
	transcript_prompt: string;
}

const EMPTY_EPISODE_FORM: EpisodeProfileFormData = {
	name: "",
	speaker_profile_id: null,
	num_segments: 3,
	language: "en",
	default_briefing: "",
	outline_prompt: "",
	transcript_prompt: "",
};

// =============================================================================
// Main Component
// =============================================================================

export function PodcastProfileManager({ searchSpaceId }: PodcastProfileManagerProps) {
	const t = useTranslations("podcastSettings");

	// Speaker profile mutations
	const { mutateAsync: createSpeaker, isPending: isCreatingSpeaker } = useAtomValue(
		createSpeakerProfileMutationAtom
	);
	const { mutateAsync: updateSpeaker, isPending: isUpdatingSpeaker } = useAtomValue(
		updateSpeakerProfileMutationAtom
	);
	const { mutateAsync: deleteSpeaker, isPending: isDeletingSpeaker } = useAtomValue(
		deleteSpeakerProfileMutationAtom
	);
	const { mutateAsync: duplicateSpeaker, isPending: isDuplicatingSpeaker } = useAtomValue(
		duplicateSpeakerProfileMutationAtom
	);

	// Episode profile mutations
	const { mutateAsync: createEpisode, isPending: isCreatingEpisode } = useAtomValue(
		createEpisodeProfileMutationAtom
	);
	const { mutateAsync: updateEpisode, isPending: isUpdatingEpisode } = useAtomValue(
		updateEpisodeProfileMutationAtom
	);
	const { mutateAsync: deleteEpisode, isPending: isDeletingEpisode } = useAtomValue(
		deleteEpisodeProfileMutationAtom
	);
	const { mutateAsync: duplicateEpisode, isPending: isDuplicatingEpisode } = useAtomValue(
		duplicateEpisodeProfileMutationAtom
	);

	// Queries
	const {
		data: speakerProfiles,
		isFetching: speakersLoading,
		error: speakersFetchError,
		refetch: refreshSpeakers,
	} = useAtomValue(speakerProfilesAtom);
	const {
		data: episodeProfiles,
		isFetching: episodesLoading,
		error: episodesFetchError,
		refetch: refreshEpisodes,
	} = useAtomValue(episodeProfilesAtom);

	// Permissions
	const { data: access } = useAtomValue(myAccessAtom);
	const canCreate = useMemo(() => {
		if (!access) return false;
		if (access.is_owner) return true;
		return access.permissions?.includes("podcasts:create") ?? false;
	}, [access]);
	const canDelete = useMemo(() => {
		if (!access) return false;
		if (access.is_owner) return true;
		return access.permissions?.includes("podcasts:delete") ?? false;
	}, [access]);
	const canUpdate = useMemo(() => {
		if (!access) return false;
		if (access.is_owner) return true;
		return access.permissions?.includes("podcasts:update") ?? false;
	}, [access]);
	const isReadOnly = !canCreate && !canDelete && !canUpdate;

	// Local state
	const [isSpeakerDialogOpen, setIsSpeakerDialogOpen] = useState(false);
	const [editingSpeakerProfile, setEditingSpeakerProfile] = useState<SpeakerProfile | null>(null);
	const [speakerToDelete, setSpeakerToDelete] = useState<SpeakerProfile | null>(null);
	const [speakerForm, setSpeakerForm] = useState<SpeakerProfileFormData>({ ...EMPTY_SPEAKER_FORM });

	const [isEpisodeDialogOpen, setIsEpisodeDialogOpen] = useState(false);
	const [editingEpisodeProfile, setEditingEpisodeProfile] = useState<EpisodeProfile | null>(null);
	const [episodeToDelete, setEpisodeToDelete] = useState<EpisodeProfile | null>(null);
	const [episodeForm, setEpisodeForm] = useState<EpisodeProfileFormData>({ ...EMPTY_EPISODE_FORM });

	const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
	const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

	const isLoading = speakersLoading || episodesLoading;
	const isSubmittingSpeaker = isCreatingSpeaker || isUpdatingSpeaker;
	const isSubmittingEpisode = isCreatingEpisode || isUpdatingEpisode;
	const errors = [speakersFetchError, episodesFetchError].filter(Boolean) as Error[];

	// =========================================================================
	// Speaker Profile Handlers
	// =========================================================================

	const resetSpeakerForm = useCallback(
		() => setSpeakerForm({ ...EMPTY_SPEAKER_FORM, speakers: [{ ...DEFAULT_SPEAKER }] }),
		[]
	);

	const openNewSpeakerDialog = () => {
		setEditingSpeakerProfile(null);
		resetSpeakerForm();
		setIsSpeakerDialogOpen(true);
	};

	const openEditSpeakerDialog = (profile: SpeakerProfile) => {
		setEditingSpeakerProfile(profile);
		setSpeakerForm({
			name: profile.name,
			tts_provider: profile.tts_provider || "",
			tts_model: profile.tts_model || "",
			speakers: profile.speakers.map((s) => ({ ...s })),
		});
		setIsSpeakerDialogOpen(true);
	};

	const handleSpeakerFormSubmit = useCallback(async () => {
		if (!speakerForm.name || !speakerForm.tts_provider || !speakerForm.tts_model) {
			toast.error(t("required_fields_error"));
			return;
		}
		const validSpeakers = speakerForm.speakers.filter((s) => s.name && s.voice_id);
		if (validSpeakers.length === 0) {
			toast.error(t("speaker_required"));
			return;
		}
		try {
			if (editingSpeakerProfile) {
				await updateSpeaker({
					id: editingSpeakerProfile.id,
					data: {
						name: speakerForm.name,
						tts_provider: speakerForm.tts_provider,
						tts_model: speakerForm.tts_model,
						speakers: validSpeakers,
					},
				});
			} else {
				await createSpeaker({
					name: speakerForm.name,
					search_space_id: searchSpaceId,
					tts_provider: speakerForm.tts_provider,
					tts_model: speakerForm.tts_model,
					speakers: validSpeakers,
				});
			}
			setIsSpeakerDialogOpen(false);
			setEditingSpeakerProfile(null);
			resetSpeakerForm();
		} catch {
			// Error handled by mutation
		}
	}, [
		editingSpeakerProfile,
		speakerForm,
		searchSpaceId,
		createSpeaker,
		updateSpeaker,
		t,
		resetSpeakerForm,
	]);

	const handleDeleteSpeaker = async () => {
		if (!speakerToDelete) return;
		try {
			await deleteSpeaker(speakerToDelete.id);
			setSpeakerToDelete(null);
		} catch {
			// Error handled by mutation
		}
	};

	const addSpeaker = () => {
		if (speakerForm.speakers.length >= 4) return;
		setSpeakerForm((p) => ({ ...p, speakers: [...p.speakers, { ...DEFAULT_SPEAKER }] }));
	};

	const removeSpeaker = (index: number) => {
		if (speakerForm.speakers.length <= 1) return;
		setSpeakerForm((p) => ({
			...p,
			speakers: p.speakers.filter((_, i) => i !== index),
		}));
	};

	const updateSpeakerField = (index: number, field: keyof Speaker, value: string) => {
		setSpeakerForm((p) => ({
			...p,
			speakers: p.speakers.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
		}));
	};

	// =========================================================================
	// Episode Profile Handlers
	// =========================================================================

	const resetEpisodeForm = useCallback(() => setEpisodeForm({ ...EMPTY_EPISODE_FORM }), []);

	const openNewEpisodeDialog = () => {
		setEditingEpisodeProfile(null);
		resetEpisodeForm();
		setIsEpisodeDialogOpen(true);
	};

	const openEditEpisodeDialog = (profile: EpisodeProfile) => {
		setEditingEpisodeProfile(profile);
		setEpisodeForm({
			name: profile.name,
			speaker_profile_id: profile.speaker_profile_id ?? null,
			num_segments: profile.num_segments,
			language: profile.language,
			default_briefing: profile.default_briefing || "",
			outline_prompt: profile.outline_prompt || "",
			transcript_prompt: profile.transcript_prompt || "",
		});
		setIsEpisodeDialogOpen(true);
	};

	const handleEpisodeFormSubmit = useCallback(async () => {
		if (!episodeForm.name) {
			toast.error(t("name_required"));
			return;
		}
		try {
			if (editingEpisodeProfile) {
				await updateEpisode({
					id: editingEpisodeProfile.id,
					data: {
						name: episodeForm.name,
						speaker_profile_id: episodeForm.speaker_profile_id,
						num_segments: episodeForm.num_segments,
						language: episodeForm.language,
						default_briefing: episodeForm.default_briefing || undefined,
						outline_prompt: episodeForm.outline_prompt || undefined,
						transcript_prompt: episodeForm.transcript_prompt || undefined,
					},
				});
			} else {
				await createEpisode({
					name: episodeForm.name,
					search_space_id: searchSpaceId,
					speaker_profile_id: episodeForm.speaker_profile_id,
					num_segments: episodeForm.num_segments,
					language: episodeForm.language,
					default_briefing: episodeForm.default_briefing || undefined,
					outline_prompt: episodeForm.outline_prompt || undefined,
					transcript_prompt: episodeForm.transcript_prompt || undefined,
				});
			}
			setIsEpisodeDialogOpen(false);
			setEditingEpisodeProfile(null);
			resetEpisodeForm();
		} catch {
			// Error handled by mutation
		}
	}, [
		editingEpisodeProfile,
		episodeForm,
		searchSpaceId,
		createEpisode,
		updateEpisode,
		t,
		resetEpisodeForm,
	]);

	const handleDeleteEpisode = async () => {
		if (!episodeToDelete) return;
		try {
			await deleteEpisode(episodeToDelete.id);
			setEpisodeToDelete(null);
		} catch {
			// Error handled by mutation
		}
	};

	// =========================================================================
	// Template Handler
	// =========================================================================

	const handleApplyTemplate = async (template: PodcastTemplate) => {
		setIsApplyingTemplate(true);
		try {
			const speakerResult = await createSpeaker({
				name: template.speakerProfile.name,
				search_space_id: searchSpaceId,
				tts_provider: template.speakerProfile.tts_provider,
				tts_model: template.speakerProfile.tts_model,
				speakers: template.speakerProfile.speakers,
			});
			await createEpisode({
				name: template.episodeProfile.name,
				search_space_id: searchSpaceId,
				speaker_profile_id: speakerResult.id,
				num_segments: template.episodeProfile.num_segments,
				language: template.episodeProfile.language,
				default_briefing: template.episodeProfile.default_briefing,
			});
			toast.success(t("template_success", { name: template.name }));
			setIsTemplateDialogOpen(false);
		} catch {
			// Errors handled by mutations
		} finally {
			setIsApplyingTemplate(false);
		}
	};

	// =========================================================================
	// Voice suggestions for current provider
	// =========================================================================

	const voiceSuggestions = getVoicesByProvider(speakerForm.tts_provider);

	// =========================================================================
	// Speaker profile name lookup for episode cards
	// =========================================================================

	const speakerProfileMap = useMemo(() => {
		const map = new Map<number, string>();
		if (speakerProfiles) {
			for (const p of speakerProfiles) {
				map.set(p.id, p.name);
			}
		}
		return map;
	}, [speakerProfiles]);

	const languageLabel = (code: string) => LANGUAGES.find((l) => l.value === code)?.label || code;

	// =========================================================================
	// Render
	// =========================================================================

	return (
		<div className="space-y-6 md:space-y-8">
			{/* Errors */}
			<AnimatePresence>
				{errors.map((err) => (
					<motion.div
						key={err?.message}
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
					>
						<Alert variant="destructive" className="py-3">
							<AlertCircle className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
							<AlertDescription className="text-xs md:text-sm">{err?.message}</AlertDescription>
						</Alert>
					</motion.div>
				))}
			</AnimatePresence>

			{/* Read-only notice */}
			{access && !isLoading && isReadOnly && (
				<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
					<Alert className="bg-muted/50 py-3 md:py-4">
						<Info className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
						<AlertDescription className="text-xs md:text-sm">
							{t("read_only_notice")}
						</AlertDescription>
					</Alert>
				</motion.div>
			)}

			{/* ================================================================= */}
			{/* Speaker Profiles Section                                          */}
			{/* ================================================================= */}
			<div className="space-y-4">
				<div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
					<div className="flex items-center gap-3">
						<h3 className="text-base font-semibold">{t("speaker_profiles")}</h3>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refreshSpeakers()}
							disabled={speakersLoading}
							className="flex items-center gap-2 text-xs h-7"
						>
							<RefreshCw className={cn("h-3 w-3", speakersLoading && "animate-spin")} />
							{t("refresh")}
						</Button>
					</div>
					{canCreate && (
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								onClick={() => setIsTemplateDialogOpen(true)}
								size="sm"
								className="flex items-center gap-2 text-xs md:text-sm h-8 md:h-9"
							>
								<LayoutTemplate className="h-3 w-3 md:h-4 md:w-4" />
								{t("use_template")}
							</Button>
							<Button
								onClick={openNewSpeakerDialog}
								size="sm"
								className="flex items-center gap-2 text-xs md:text-sm h-8 md:h-9"
							>
								<Plus className="h-3 w-3 md:h-4 md:w-4" />
								{t("add_speaker_profile")}
							</Button>
						</div>
					)}
				</div>

				{/* Loading */}
				{speakersLoading && (
					<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
						{["sk-a", "sk-b"].map((key) => (
							<Card key={key} className="border-border/60">
								<CardContent className="p-4 flex flex-col gap-3">
									<Skeleton className="h-4 w-28" />
									<div className="flex gap-2">
										<Skeleton className="h-5 w-16 rounded-full" />
										<Skeleton className="h-5 w-20 rounded-full" />
									</div>
									<Skeleton className="h-3 w-24" />
								</CardContent>
							</Card>
						))}
					</div>
				)}

				{/* Empty state */}
				{!speakersLoading && (speakerProfiles?.length ?? 0) === 0 && (
					<Card className="border-dashed border-2 border-muted-foreground/25">
						<CardContent className="flex flex-col items-center justify-center py-10 md:py-14 text-center">
							<div className="rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-4 md:p-6 mb-4">
								<Users className="h-8 w-8 md:h-12 md:w-12 text-violet-600 dark:text-violet-400" />
							</div>
							<h3 className="text-lg font-semibold mb-2">{t("no_speaker_title")}</h3>
							<p className="text-xs md:text-sm text-muted-foreground max-w-sm mb-4">
								{canCreate ? t("no_speaker_desc_creator") : t("no_speaker_desc_viewer")}
							</p>
							{canCreate && (
								<Button
									onClick={openNewSpeakerDialog}
									size="lg"
									className="gap-2 text-xs md:text-sm h-9 md:h-10"
								>
									<Plus className="h-3 w-3 md:h-4 md:w-4" />
									{t("add_first_speaker")}
								</Button>
							)}
						</CardContent>
					</Card>
				)}

				{/* Speaker profile cards */}
				{!speakersLoading && (speakerProfiles?.length ?? 0) > 0 && (
					<motion.div
						variants={container}
						initial="hidden"
						animate="show"
						className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
					>
						<AnimatePresence mode="popLayout">
							{speakerProfiles?.map((profile) => (
								<motion.div
									key={profile.id}
									variants={item}
									layout
									exit={{ opacity: 0, scale: 0.95 }}
								>
									<Card className="group relative overflow-hidden transition-all duration-200 border-border/60 hover:shadow-md h-full">
										<CardContent className="p-4 flex flex-col gap-3 h-full">
											{/* Header */}
											<div className="flex items-start justify-between gap-2">
												<h4 className="text-sm font-semibold tracking-tight truncate flex-1 min-w-0">
													{profile.name}
												</h4>
												{(canCreate || canUpdate || canDelete) && (
													<div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
														{canCreate && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => duplicateSpeaker(profile.id)}
																			disabled={isDuplicatingSpeaker}
																			className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		>
																			<Copy className="h-3 w-3" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>{t("duplicate_tooltip")}</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
														{canUpdate && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => openEditSpeakerDialog(profile)}
																			className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		>
																			<Edit3 className="h-3 w-3" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>{t("edit_tooltip")}</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
														{canDelete && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => setSpeakerToDelete(profile)}
																			className="h-7 w-7 text-muted-foreground hover:text-destructive"
																		>
																			<Trash2 className="h-3 w-3" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>{t("delete_tooltip")}</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</div>
												)}
											</div>

											{/* Badges */}
											<div className="flex items-center gap-2 flex-wrap">
												{profile.tts_provider && (
													<Badge variant="secondary" className="text-[11px]">
														{profile.tts_provider}
													</Badge>
												)}
												<Badge variant="outline" className="text-[11px]">
													{t("speaker_count", { count: profile.speakers.length })}
												</Badge>
											</div>

											{/* Speaker names */}
											<p className="text-[11px] text-muted-foreground/70 truncate">
												{profile.speakers.map((s) => s.name).join(", ")}
											</p>

											{/* Footer */}
											<div className="flex items-center gap-2 pt-2 border-t border-border/40 mt-auto">
												<span className="text-[11px] text-muted-foreground/60">
													{new Date(profile.created_at).toLocaleDateString(undefined, {
														year: "numeric",
														month: "short",
														day: "numeric",
													})}
												</span>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							))}
						</AnimatePresence>
					</motion.div>
				)}
			</div>

			<Separator />

			{/* ================================================================= */}
			{/* Episode Profiles Section                                          */}
			{/* ================================================================= */}
			<div className="space-y-4">
				<div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
					<div className="flex items-center gap-3">
						<h3 className="text-base font-semibold">{t("episode_profiles")}</h3>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refreshEpisodes()}
							disabled={episodesLoading}
							className="flex items-center gap-2 text-xs h-7"
						>
							<RefreshCw className={cn("h-3 w-3", episodesLoading && "animate-spin")} />
							{t("refresh")}
						</Button>
					</div>
					{canCreate && (
						<Button
							onClick={openNewEpisodeDialog}
							size="sm"
							className="flex items-center gap-2 text-xs md:text-sm h-8 md:h-9"
						>
							<Plus className="h-3 w-3 md:h-4 md:w-4" />
							{t("add_episode_profile")}
						</Button>
					)}
				</div>

				{/* Loading */}
				{episodesLoading && (
					<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
						{["ek-a", "ek-b"].map((key) => (
							<Card key={key} className="border-border/60">
								<CardContent className="p-4 flex flex-col gap-3">
									<Skeleton className="h-4 w-28" />
									<div className="flex gap-2">
										<Skeleton className="h-5 w-20 rounded-full" />
										<Skeleton className="h-5 w-14 rounded-full" />
									</div>
									<Skeleton className="h-3 w-24" />
								</CardContent>
							</Card>
						))}
					</div>
				)}

				{/* Empty state */}
				{!episodesLoading && (episodeProfiles?.length ?? 0) === 0 && (
					<Card className="border-dashed border-2 border-muted-foreground/25">
						<CardContent className="flex flex-col items-center justify-center py-10 md:py-14 text-center">
							<div className="rounded-full bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-4 md:p-6 mb-4">
								<Mic className="h-8 w-8 md:h-12 md:w-12 text-orange-600 dark:text-orange-400" />
							</div>
							<h3 className="text-lg font-semibold mb-2">{t("no_episode_title")}</h3>
							<p className="text-xs md:text-sm text-muted-foreground max-w-sm mb-4">
								{canCreate ? t("no_episode_desc_creator") : t("no_episode_desc_viewer")}
							</p>
							{canCreate && (
								<Button
									onClick={openNewEpisodeDialog}
									size="lg"
									className="gap-2 text-xs md:text-sm h-9 md:h-10"
								>
									<Plus className="h-3 w-3 md:h-4 md:w-4" />
									{t("add_first_episode")}
								</Button>
							)}
						</CardContent>
					</Card>
				)}

				{/* Episode profile cards */}
				{!episodesLoading && (episodeProfiles?.length ?? 0) > 0 && (
					<motion.div
						variants={container}
						initial="hidden"
						animate="show"
						className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
					>
						<AnimatePresence mode="popLayout">
							{episodeProfiles?.map((profile) => (
								<motion.div
									key={profile.id}
									variants={item}
									layout
									exit={{ opacity: 0, scale: 0.95 }}
								>
									<Card className="group relative overflow-hidden transition-all duration-200 border-border/60 hover:shadow-md h-full">
										<CardContent className="p-4 flex flex-col gap-3 h-full">
											{/* Header */}
											<div className="flex items-start justify-between gap-2">
												<h4 className="text-sm font-semibold tracking-tight truncate flex-1 min-w-0">
													{profile.name}
												</h4>
												{(canCreate || canUpdate || canDelete) && (
													<div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
														{canCreate && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => duplicateEpisode(profile.id)}
																			disabled={isDuplicatingEpisode}
																			className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		>
																			<Copy className="h-3 w-3" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>{t("duplicate_tooltip")}</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
														{canUpdate && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => openEditEpisodeDialog(profile)}
																			className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		>
																			<Edit3 className="h-3 w-3" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>{t("edit_tooltip")}</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
														{canDelete && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => setEpisodeToDelete(profile)}
																			className="h-7 w-7 text-muted-foreground hover:text-destructive"
																		>
																			<Trash2 className="h-3 w-3" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>{t("delete_tooltip")}</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</div>
												)}
											</div>

											{/* Badges */}
											<div className="flex items-center gap-2 flex-wrap">
												{profile.speaker_profile_id &&
													speakerProfileMap.has(profile.speaker_profile_id) && (
														<Badge variant="secondary" className="text-[11px]">
															{speakerProfileMap.get(profile.speaker_profile_id)}
														</Badge>
													)}
												<Badge variant="outline" className="text-[11px]">
													{t("segment_count", { count: profile.num_segments })}
												</Badge>
												<Badge variant="outline" className="text-[11px]">
													{languageLabel(profile.language)}
												</Badge>
											</div>

											{/* Briefing preview */}
											{profile.default_briefing && (
												<p className="text-[11px] text-muted-foreground/70 truncate">
													{profile.default_briefing}
												</p>
											)}

											{/* Footer */}
											<div className="flex items-center gap-2 pt-2 border-t border-border/40 mt-auto">
												<span className="text-[11px] text-muted-foreground/60">
													{new Date(profile.created_at).toLocaleDateString(undefined, {
														year: "numeric",
														month: "short",
														day: "numeric",
													})}
												</span>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							))}
						</AnimatePresence>
					</motion.div>
				)}
			</div>

			{/* ================================================================= */}
			{/* Speaker Profile Dialog                                            */}
			{/* ================================================================= */}
			<Dialog
				open={isSpeakerDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsSpeakerDialogOpen(false);
						setEditingSpeakerProfile(null);
						resetSpeakerForm();
					}
				}}
			>
				<DialogContent
					className="max-w-2xl max-h-[90vh] overflow-y-auto"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>
							{editingSpeakerProfile
								? t("edit_speaker_dialog_title")
								: t("add_speaker_dialog_title")}
						</DialogTitle>
						<DialogDescription>
							{editingSpeakerProfile ? t("edit_speaker_dialog_desc") : t("add_speaker_dialog_desc")}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-2">
						{/* Name */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">{t("name_label")}</Label>
							<Input
								placeholder={t("name_placeholder_speaker")}
								value={speakerForm.name}
								onChange={(e) => setSpeakerForm((p) => ({ ...p, name: e.target.value }))}
							/>
						</div>

						<Separator />

						{/* TTS Provider */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-sm font-medium">{t("tts_provider_label")}</Label>
								<Select
									value={speakerForm.tts_provider}
									onValueChange={(val) => setSpeakerForm((p) => ({ ...p, tts_provider: val }))}
								>
									<SelectTrigger>
										<SelectValue placeholder={t("select_provider")} />
									</SelectTrigger>
									<SelectContent>
										{TTS_PROVIDERS.map((p) => (
											<SelectItem key={p.value} value={p.value}>
												<div className="flex flex-col">
													<span className="font-medium">{p.label}</span>
													<span className="text-xs text-muted-foreground">{p.description}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label className="text-sm font-medium">{t("tts_model_label")}</Label>
								<Input
									placeholder={t("tts_model_placeholder")}
									value={speakerForm.tts_model}
									onChange={(e) => setSpeakerForm((p) => ({ ...p, tts_model: e.target.value }))}
								/>
							</div>
						</div>

						<Separator />

						{/* Speakers list */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">
									{t("speakers_label", { count: speakerForm.speakers.length })}
								</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addSpeaker}
									disabled={speakerForm.speakers.length >= 4}
									className="text-xs h-7"
								>
									<Plus className="h-3 w-3 mr-1" />
									{t("add_speaker")}
								</Button>
							</div>

							{speakerForm.speakers.map((speaker, idx) => (
								<Card
									key={`speaker-${speaker.name || ""}-${speaker.voice_id || ""}-${idx}`}
									className="border-border/60"
								>
									<CardContent className="p-3 space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-muted-foreground">
												{t("speaker_n", { n: idx + 1 })}
											</span>
											{speakerForm.speakers.length > 1 && (
												<Button
													type="button"
													variant="ghost"
													size="icon"
													onClick={() => removeSpeaker(idx)}
													className="h-6 w-6 text-muted-foreground hover:text-destructive"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											)}
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-1.5">
												<Label className="text-xs">{t("speaker_name_label")}</Label>
												<Input
													placeholder={t("speaker_name_placeholder")}
													value={speaker.name}
													onChange={(e) => updateSpeakerField(idx, "name", e.target.value)}
													className="h-8 text-sm"
												/>
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs">{t("voice_id_label")}</Label>
												{voiceSuggestions.length > 0 ? (
													<Select
														value={speaker.voice_id}
														onValueChange={(val) => updateSpeakerField(idx, "voice_id", val)}
													>
														<SelectTrigger className="h-8 text-sm">
															<SelectValue placeholder={t("select_voice")} />
														</SelectTrigger>
														<SelectContent>
															{voiceSuggestions.map((v) => (
																<SelectItem key={v.value} value={v.value}>
																	{v.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												) : (
													<Input
														placeholder={t("voice_id_placeholder")}
														value={speaker.voice_id}
														onChange={(e) => updateSpeakerField(idx, "voice_id", e.target.value)}
														className="h-8 text-sm"
													/>
												)}
											</div>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">{t("backstory_label")}</Label>
											<Textarea
												placeholder={t("backstory_placeholder")}
												value={speaker.backstory}
												onChange={(e) => updateSpeakerField(idx, "backstory", e.target.value)}
												className="text-sm min-h-[60px]"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">{t("personality_label")}</Label>
											<Textarea
												placeholder={t("personality_placeholder")}
												value={speaker.personality}
												onChange={(e) => updateSpeakerField(idx, "personality", e.target.value)}
												className="text-sm min-h-[60px]"
											/>
										</div>
									</CardContent>
								</Card>
							))}
						</div>

						{/* Actions */}
						<div className="flex gap-3 pt-4 border-t">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => {
									setIsSpeakerDialogOpen(false);
									setEditingSpeakerProfile(null);
									resetSpeakerForm();
								}}
							>
								{t("cancel")}
							</Button>
							<Button
								className="flex-1"
								onClick={handleSpeakerFormSubmit}
								disabled={
									isSubmittingSpeaker ||
									!speakerForm.name ||
									!speakerForm.tts_provider ||
									!speakerForm.tts_model ||
									speakerForm.speakers.every((s) => !s.name || !s.voice_id)
								}
							>
								{isSubmittingSpeaker ? <Spinner size="sm" className="mr-2" /> : null}
								{editingSpeakerProfile ? t("save_changes") : t("create")}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* ================================================================= */}
			{/* Episode Profile Dialog                                            */}
			{/* ================================================================= */}
			<Dialog
				open={isEpisodeDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsEpisodeDialogOpen(false);
						setEditingEpisodeProfile(null);
						resetEpisodeForm();
					}
				}}
			>
				<DialogContent
					className="max-w-lg max-h-[90vh] overflow-y-auto"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>
							{editingEpisodeProfile
								? t("edit_episode_dialog_title")
								: t("add_episode_dialog_title")}
						</DialogTitle>
						<DialogDescription>
							{editingEpisodeProfile ? t("edit_episode_dialog_desc") : t("add_episode_dialog_desc")}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-2">
						{/* Name */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">{t("name_label")}</Label>
							<Input
								placeholder={t("name_placeholder_episode")}
								value={episodeForm.name}
								onChange={(e) => setEpisodeForm((p) => ({ ...p, name: e.target.value }))}
							/>
						</div>

						<Separator />

						{/* Speaker Profile */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">{t("speaker_profile_label")}</Label>
							<Select
								value={episodeForm.speaker_profile_id?.toString() ?? "none"}
								onValueChange={(val) =>
									setEpisodeForm((p) => ({
										...p,
										speaker_profile_id: val === "none" ? null : Number(val),
									}))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder={t("select_speaker_optional")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">{t("none")}</SelectItem>
									{speakerProfiles?.map((sp) => (
										<SelectItem key={sp.id} value={sp.id.toString()}>
											{sp.name} ({t("speaker_count", { count: sp.speakers.length })})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Segments + Language */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label className="text-sm font-medium">{t("segments_label")}</Label>
								<Input
									type="number"
									min={1}
									max={10}
									value={episodeForm.num_segments}
									onChange={(e) =>
										setEpisodeForm((p) => ({
											...p,
											num_segments: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-sm font-medium">{t("language_label")}</Label>
								<Select
									value={episodeForm.language}
									onValueChange={(val) => setEpisodeForm((p) => ({ ...p, language: val }))}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{LANGUAGES.map((l) => (
											<SelectItem key={l.value} value={l.value}>
												{l.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Default Briefing */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">{t("default_briefing_label")}</Label>
							<Textarea
								placeholder={t("default_briefing_placeholder")}
								value={episodeForm.default_briefing}
								onChange={(e) =>
									setEpisodeForm((p) => ({ ...p, default_briefing: e.target.value }))
								}
								className="min-h-[80px]"
							/>
						</div>

						{/* Outline Prompt */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">{t("outline_prompt_label")}</Label>
							<Textarea
								placeholder={t("outline_prompt_placeholder")}
								value={episodeForm.outline_prompt}
								onChange={(e) => setEpisodeForm((p) => ({ ...p, outline_prompt: e.target.value }))}
								className="min-h-[60px]"
							/>
						</div>

						{/* Transcript Prompt */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">{t("transcript_prompt_label")}</Label>
							<Textarea
								placeholder={t("transcript_prompt_placeholder")}
								value={episodeForm.transcript_prompt}
								onChange={(e) =>
									setEpisodeForm((p) => ({ ...p, transcript_prompt: e.target.value }))
								}
								className="min-h-[60px]"
							/>
						</div>

						{/* Actions */}
						<div className="flex gap-3 pt-4 border-t">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => {
									setIsEpisodeDialogOpen(false);
									setEditingEpisodeProfile(null);
									resetEpisodeForm();
								}}
							>
								{t("cancel")}
							</Button>
							<Button
								className="flex-1"
								onClick={handleEpisodeFormSubmit}
								disabled={isSubmittingEpisode || !episodeForm.name}
							>
								{isSubmittingEpisode ? <Spinner size="sm" className="mr-2" /> : null}
								{editingEpisodeProfile ? t("save_changes") : t("create")}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* ================================================================= */}
			{/* Delete Speaker Confirmation                                       */}
			{/* ================================================================= */}
			<AlertDialog
				open={!!speakerToDelete}
				onOpenChange={(open) => !open && setSpeakerToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<Trash2 className="h-5 w-5 text-destructive" />
							{t("delete_speaker_title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("delete_speaker_confirm", { name: speakerToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingSpeaker}>{t("cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteSpeaker}
							disabled={isDeletingSpeaker}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeletingSpeaker ? (
								<>
									<Spinner size="sm" className="mr-2" />
									{t("deleting")}
								</>
							) : (
								<>
									<Trash2 className="mr-2 h-4 w-4" />
									{t("delete")}
								</>
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* ================================================================= */}
			{/* Delete Episode Confirmation                                       */}
			{/* ================================================================= */}
			<AlertDialog
				open={!!episodeToDelete}
				onOpenChange={(open) => !open && setEpisodeToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<Trash2 className="h-5 w-5 text-destructive" />
							{t("delete_episode_title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("delete_episode_confirm", { name: episodeToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingEpisode}>{t("cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteEpisode}
							disabled={isDeletingEpisode}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeletingEpisode ? (
								<>
									<Spinner size="sm" className="mr-2" />
									{t("deleting")}
								</>
							) : (
								<>
									<Trash2 className="mr-2 h-4 w-4" />
									{t("delete")}
								</>
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* ================================================================= */}
			{/* Template Dialog                                                   */}
			{/* ================================================================= */}
			<Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{t("template_title")}</DialogTitle>
						<DialogDescription>{t("template_desc")}</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 pt-2">
						{PODCAST_TEMPLATES.map((template) => (
							<Card
								key={template.key}
								className={cn(
									"border-border/60 transition-all duration-200",
									isApplyingTemplate
										? "opacity-50 pointer-events-none"
										: "cursor-pointer hover:border-primary/40 hover:shadow-md"
								)}
								onClick={() => !isApplyingTemplate && handleApplyTemplate(template)}
							>
								<CardContent className="p-4 flex flex-col gap-2">
									<h4 className="text-sm font-semibold">{template.name}</h4>
									<p className="text-xs text-muted-foreground">{template.description}</p>
									<div className="flex items-center gap-2 flex-wrap pt-1">
										<Badge variant="secondary" className="text-[11px]">
											{t("speaker_count", { count: template.speakerProfile.speakers.length })}
										</Badge>
										<Badge variant="outline" className="text-[11px]">
											{t("segment_count", { count: template.episodeProfile.num_segments })}
										</Badge>
										<Badge variant="outline" className="text-[11px]">
											{template.episodeProfile.language}
										</Badge>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
					{isApplyingTemplate && (
						<div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
							<Spinner size="sm" />
							<span className="text-sm">{t("creating_profiles")}</span>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
