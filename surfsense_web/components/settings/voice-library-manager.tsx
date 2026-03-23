"use client";

import { useAtomValue } from "jotai";
import { Mic, Play, Plus, Square, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createCloneVoiceProfileMutationAtom,
	createVoiceProfileMutationAtom,
	deleteVoiceProfileMutationAtom,
} from "@/atoms/voice-profiles/voice-profiles-mutation.atoms";
import { voiceProfilesAtom } from "@/atoms/voice-profiles/voice-profiles-query.atoms";
import { activeSearchSpaceIdAtom } from "@/atoms/search-spaces/search-space-query.atoms";
import {
	AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
	AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { VoiceProfile } from "@/contracts/types/voice-profile.types";
import { voiceProfilesApiService } from "@/lib/apis/voice-profiles-api.service";

const QWEN3_VOICES = [
	{ value: "aiden", label: "Aiden (Male)" },
	{ value: "dylan", label: "Dylan (Male)" },
	{ value: "eric", label: "Eric (Male)" },
	{ value: "ryan", label: "Ryan (Male)" },
	{ value: "ono_anna", label: "Ono Anna (Female)" },
	{ value: "serena", label: "Serena (Female)" },
	{ value: "sohee", label: "Sohee (Female)" },
	{ value: "uncle_fu", label: "Uncle Fu (Male)" },
	{ value: "vivian", label: "Vivian (Female)" },
];

const TTS_LANGUAGES = [
	{ value: "es", label: "Español" }, { value: "en", label: "English" },
	{ value: "pt", label: "Português" }, { value: "fr", label: "Français" },
	{ value: "de", label: "Deutsch" }, { value: "zh", label: "中文" },
	{ value: "ja", label: "日本語" }, { value: "ko", label: "한국어" },
	{ value: "ru", label: "Русский" }, { value: "it", label: "Italiano" },
];

const TYPE_KEYS: Record<string, string> = { preset: "type_preset", design: "type_designed", clone: "type_cloned" };

type DialogMode = null | "preset" | "design" | "clone";

interface VoiceLibraryManagerProps { canCreate: boolean; canDelete: boolean; }

function LanguageSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{TTS_LANGUAGES.map((l) => (
						<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}

export function VoiceLibraryManager({ canCreate, canDelete }: VoiceLibraryManagerProps) {
	const t = useTranslations("voiceLibrarySettings");
	const { data: voiceProfiles, isFetching: isLoading } = useAtomValue(voiceProfilesAtom);
	const { mutateAsync: createVoiceProfile, isPending: isCreating } = useAtomValue(createVoiceProfileMutationAtom);
	const { mutateAsync: createCloneProfile, isPending: isCloning } = useAtomValue(createCloneVoiceProfileMutationAtom);
	const { mutateAsync: deleteVoiceProfile, isPending: isDeleting } = useAtomValue(deleteVoiceProfileMutationAtom);
	const searchSpaceId = useAtomValue(activeSearchSpaceIdAtom);

	const [dialogMode, setDialogMode] = useState<DialogMode>(null);
	const [profileToDelete, setProfileToDelete] = useState<VoiceProfile | null>(null);
	const [previewingId, setPreviewingId] = useState<number | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Form state
	const [presetName, setPresetName] = useState("");
	const [presetVoiceId, setPresetVoiceId] = useState("");
	const [presetStyle, setPresetStyle] = useState("");
	const [presetLang, setPresetLang] = useState("");
	const [designName, setDesignName] = useState("");
	const [designInstructions, setDesignInstructions] = useState("");
	const [designLang, setDesignLang] = useState("");
	const [cloneName, setCloneName] = useState("");
	const [cloneFile, setCloneFile] = useState<File | null>(null);
	const [cloneRefText, setCloneRefText] = useState("");
	const [cloneLang, setCloneLang] = useState("");

	const resetForms = useCallback(() => {
		setPresetName(""); setPresetVoiceId(""); setPresetStyle(""); setPresetLang("");
		setDesignName(""); setDesignInstructions(""); setDesignLang("");
		setCloneName(""); setCloneFile(null); setCloneRefText(""); setCloneLang("");
	}, []);

	const closeDialog = useCallback(() => { setDialogMode(null); resetForms(); }, [resetForms]);
	const isSubmitting = isCreating || isCloning;

	const handleCreatePreset = useCallback(async () => {
		if (!presetName.trim() || !presetVoiceId || !searchSpaceId) return;
		try {
			await createVoiceProfile({
				name: presetName.trim(), search_space_id: Number(searchSpaceId), voice_type: "preset",
				preset_voice_id: presetVoiceId, style_instructions: presetStyle.trim() || undefined,
				language: presetLang || undefined,
			});
			closeDialog();
		} catch { /* handled by atom */ }
	}, [presetName, presetVoiceId, presetStyle, presetLang, searchSpaceId, createVoiceProfile, closeDialog]);

	const handleCreateDesign = useCallback(async () => {
		if (!designName.trim() || !designInstructions.trim() || !searchSpaceId) return;
		try {
			await createVoiceProfile({
				name: designName.trim(), search_space_id: Number(searchSpaceId), voice_type: "design",
				design_instructions: designInstructions.trim(), language: designLang || undefined,
			});
			closeDialog();
		} catch { /* handled by atom */ }
	}, [designName, designInstructions, designLang, searchSpaceId, createVoiceProfile, closeDialog]);

	const handleCreateClone = useCallback(async () => {
		if (!cloneName.trim() || !cloneFile || !cloneRefText.trim() || !searchSpaceId) return;
		try {
			const fd = new FormData();
			fd.append("name", cloneName.trim());
			fd.append("search_space_id", String(searchSpaceId));
			fd.append("voice_type", "clone");
			fd.append("audio_file", cloneFile);
			fd.append("ref_text", cloneRefText.trim());
			if (cloneLang) fd.append("language", cloneLang);
			await createCloneProfile(fd);
			closeDialog();
		} catch { /* handled by atom */ }
	}, [cloneName, cloneFile, cloneRefText, cloneLang, searchSpaceId, createCloneProfile, closeDialog]);

	const handleDelete = useCallback(async () => {
		if (!profileToDelete) return;
		try { await deleteVoiceProfile(profileToDelete.id); setProfileToDelete(null); }
		catch { /* handled by atom */ }
	}, [profileToDelete, deleteVoiceProfile]);

	const handlePreview = useCallback(async (profile: VoiceProfile) => {
		if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
		if (previewingId === profile.id) { setPreviewingId(null); return; }
		setPreviewingId(profile.id);
		try {
			const blob = await voiceProfilesApiService.previewVoice(
				profile.id, t("preview_demo_text")
			);
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);
			audioRef.current = audio;
			audio.onended = () => { setPreviewingId(null); URL.revokeObjectURL(url); audioRef.current = null; };
			audio.onerror = () => { setPreviewingId(null); URL.revokeObjectURL(url); audioRef.current = null; toast.error(t("preview_playback_error")); };
			await audio.play();
		} catch { setPreviewingId(null); toast.error(t("preview_error")); }
	}, [previewingId]);

	return (
		<div className="flex flex-col gap-5">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold">{t("header_title")}</h3>
				{canCreate && (
					<div className="flex items-center gap-2">
						{(["preset", "design", "clone"] as const).map((mode) => (
							<Button key={mode} variant="outline" size="sm" onClick={() => setDialogMode(mode)} className="text-xs h-8">
								<Plus data-icon="inline-start" />
								{t(`create_${mode}`)}
							</Button>
						))}
					</div>
				)}
			</div>
			<Separator />

			{/* Loading */}
			{isLoading && (
				<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
					{[1, 2, 3].map((k) => (
						<Card key={k} className="border-border/60">
							<CardContent className="p-4 flex flex-col gap-3">
								<Skeleton className="h-4 w-28" />
								<div className="flex items-center gap-2">
									<Skeleton className="h-5 w-16 rounded-full" />
									<Skeleton className="h-5 w-14 rounded-full" />
								</div>
								<Skeleton className="h-8 w-20" />
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Empty */}
			{!isLoading && (!voiceProfiles || voiceProfiles.length === 0) && (
				<Card className="border-dashed border-2 border-muted-foreground/25">
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<div className="rounded-full bg-muted p-4 mb-4">
							<Mic className="size-8 text-muted-foreground" />
						</div>
						<h4 className="text-lg font-semibold mb-1">{t("no_voices_title")}</h4>
						<p className="text-sm text-muted-foreground max-w-sm">
							{canCreate ? t("no_voices_desc_creator") : t("no_voices_desc_viewer")}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Voice List */}
			{!isLoading && voiceProfiles && voiceProfiles.length > 0 && (
				<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
					{voiceProfiles.map((p) => (
						<Card key={p.id} className="group border-border/60 hover:shadow-md transition-shadow">
							<CardContent className="p-4 flex flex-col gap-3">
								<div className="flex items-start justify-between gap-2">
									<h4 className="text-sm font-semibold truncate">{p.name}</h4>
									<div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
										<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground"
											onClick={() => handlePreview(p)} disabled={previewingId !== null && previewingId !== p.id}>
											{previewingId === p.id ? <Square className="size-3" /> : <Play className="size-3" />}
										</Button>
										{canDelete && (
											<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
												onClick={() => setProfileToDelete(p)}>
												<Trash2 className="size-3" />
											</Button>
										)}
									</div>
								</div>
								<div className="flex items-center gap-1.5 flex-wrap">
									<Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
										{TYPE_KEYS[p.voice_type] ? t(TYPE_KEYS[p.voice_type]) : p.voice_type}
									</Badge>
									{p.language && (
										<Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
											{TTS_LANGUAGES.find((l) => l.value === p.language)?.label ?? p.language}
										</Badge>
									)}
									{p.preset_voice_id && (
										<Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-mono">{p.preset_voice_id}</Badge>
									)}
								</div>
								<span className="text-[11px] text-muted-foreground/60 mt-auto pt-2 border-t border-border/40">
									{new Date(p.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
								</span>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Preset Dialog */}
			<Dialog open={dialogMode === "preset"} onOpenChange={(o) => !o && closeDialog()}>
				<DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>{t("preset_dialog_title")}</DialogTitle>
						<DialogDescription>{t("preset_dialog_desc")}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 pt-2">
						<FormField label={t("name_label")} htmlFor="preset-name">
							<Input id="preset-name" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={t("name_placeholder")} />
						</FormField>
						<FormField label={t("voice_label")}>
							<Select value={presetVoiceId} onValueChange={setPresetVoiceId}>
								<SelectTrigger><SelectValue placeholder={t("voice_placeholder")} /></SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{QWEN3_VOICES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
									</SelectGroup>
								</SelectContent>
							</Select>
						</FormField>
						<FormField label={t("style_label")} htmlFor="preset-style">
							<Input id="preset-style" value={presetStyle} onChange={(e) => setPresetStyle(e.target.value)} placeholder={t("style_placeholder")} />
						</FormField>
						<FormField label={t("language_label")}><LanguageSelect value={presetLang} onChange={setPresetLang} placeholder={t("language_placeholder")} /></FormField>
						<Button onClick={handleCreatePreset} disabled={!presetName.trim() || !presetVoiceId || isSubmitting} className="mt-2">
							{isCreating ? <><Spinner data-icon="inline-start" size="sm" />{t("creating")}</> : t("create_voice")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Design Dialog */}
			<Dialog open={dialogMode === "design"} onOpenChange={(o) => !o && closeDialog()}>
				<DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>{t("design_dialog_title")}</DialogTitle>
						<DialogDescription>{t("design_dialog_desc")}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 pt-2">
						<FormField label={t("name_label")} htmlFor="design-name">
							<Input id="design-name" value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder={t("name_placeholder")} />
						</FormField>
						<FormField label={t("instructions_label")} htmlFor="design-instructions">
							<Textarea id="design-instructions" value={designInstructions} onChange={(e) => setDesignInstructions(e.target.value)}
								placeholder={t("instructions_placeholder")} rows={4} />
						</FormField>
						<FormField label={t("language_label")}><LanguageSelect value={designLang} onChange={setDesignLang} placeholder={t("language_placeholder")} /></FormField>
						<Button onClick={handleCreateDesign} disabled={!designName.trim() || !designInstructions.trim() || isSubmitting} className="mt-2">
							{isCreating ? <><Spinner data-icon="inline-start" size="sm" />{t("creating")}</> : t("create_voice")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Clone Dialog */}
			<Dialog open={dialogMode === "clone"} onOpenChange={(o) => !o && closeDialog()}>
				<DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>{t("clone_dialog_title")}</DialogTitle>
						<DialogDescription>{t("clone_dialog_desc")}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4 pt-2">
						<FormField label={t("name_label")} htmlFor="clone-name">
							<Input id="clone-name" value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder={t("name_placeholder")} />
						</FormField>
						<FormField label={t("audio_label")}>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" className="text-xs" type="button"
									onClick={() => document.getElementById("clone-audio-input")?.click()}>
									<Upload data-icon="inline-start" />{cloneFile ? cloneFile.name : t("audio_select")}
								</Button>
								<input id="clone-audio-input" type="file" accept="audio/*" className="hidden"
									onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)} />
							</div>
							{cloneFile && <span className="text-[11px] text-muted-foreground">{(cloneFile.size / 1024 / 1024).toFixed(2)} MB</span>}
						</FormField>
						<FormField label={t("ref_text_label")} htmlFor="clone-ref-text">
							<Textarea id="clone-ref-text" value={cloneRefText} onChange={(e) => setCloneRefText(e.target.value)}
								placeholder={t("ref_text_placeholder")} rows={3} />
						</FormField>
						<FormField label={t("language_label")}><LanguageSelect value={cloneLang} onChange={setCloneLang} placeholder={t("language_placeholder")} /></FormField>
						<Button onClick={handleCreateClone} disabled={!cloneName.trim() || !cloneFile || !cloneRefText.trim() || isSubmitting} className="mt-2">
							{isCloning ? <><Spinner data-icon="inline-start" size="sm" />{t("cloning")}</> : t("clone_voice")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog open={!!profileToDelete} onOpenChange={(o) => !o && setProfileToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<Trash2 className="size-5 text-destructive" />{t("delete_title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("delete_confirm", { name: profileToDelete?.name ?? "" })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete} disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							{isDeleting
								? <><Spinner size="sm" className="mr-2" />{t("deleting")}</>
								: <><Trash2 className="mr-2 size-4" />{t("delete")}</>}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
