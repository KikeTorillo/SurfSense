"use client";

import { useAtomValue } from "jotai";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createNewLLMConfigMutationAtom,
	updateLLMPreferencesMutationAtom,
} from "@/atoms/new-llm-config/new-llm-config-mutation.atoms";
import {
	globalNewLLMConfigsAtom,
	llmPreferencesAtom,
} from "@/atoms/new-llm-config/new-llm-config-query.atoms";
import { Logo } from "@/components/Logo";
import { LLMConfigForm, type LLMConfigFormData } from "@/components/shared/llm-config-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getBearerToken, redirectToLogin } from "@/lib/auth-utils";

export default function OnboardPage() {
	const t = useTranslations("onboard");
	const router = useRouter();
	const params = useParams();
	const searchSpaceId = Number(params.search_space_id);

	// Queries
	const {
		data: globalConfigs = [],
		isFetching: globalConfigsLoading,
		isSuccess: globalConfigsLoaded,
	} = useAtomValue(globalNewLLMConfigsAtom);
	const { data: preferences = {}, isFetching: preferencesLoading } =
		useAtomValue(llmPreferencesAtom);

	// Mutations
	const { mutateAsync: createConfig, isPending: isCreating } = useAtomValue(
		createNewLLMConfigMutationAtom
	);
	const { mutateAsync: updatePreferences, isPending: isUpdatingPreferences } = useAtomValue(
		updateLLMPreferencesMutationAtom
	);

	// State
	const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
	const hasAttemptedAutoConfig = useRef(false);

	// Check authentication
	useEffect(() => {
		const token = getBearerToken();
		if (!token) {
			redirectToLogin();
		}
	}, []);

	// Check if onboarding is already complete (including 0 for Auto mode)
	const isOnboardingComplete =
		preferences.agent_llm_id !== null &&
		preferences.agent_llm_id !== undefined &&
		preferences.document_summary_llm_id !== null &&
		preferences.document_summary_llm_id !== undefined;

	// If onboarding is already complete, redirect immediately
	useEffect(() => {
		if (!preferencesLoading && isOnboardingComplete) {
			router.push(`/dashboard/${searchSpaceId}/new-chat`);
		}
	}, [preferencesLoading, isOnboardingComplete, router, searchSpaceId]);

	// Auto-configure if global configs are available
	useEffect(() => {
		const autoConfigureWithGlobal = async () => {
			if (hasAttemptedAutoConfig.current) return;
			if (globalConfigsLoading || preferencesLoading) return;
			if (!globalConfigsLoaded) return;
			if (isOnboardingComplete) return;

			// Only auto-configure if we have global configs
			if (globalConfigs.length > 0) {
				hasAttemptedAutoConfig.current = true;
				setIsAutoConfiguring(true);

				try {
					const firstGlobalConfig = globalConfigs[0];

					await updatePreferences({
						search_space_id: searchSpaceId,
						data: {
							agent_llm_id: firstGlobalConfig.id,
							document_summary_llm_id: firstGlobalConfig.id,
						},
					});

					toast.success(t("auto_configured"), {
						description: t("auto_configured_desc", { name: firstGlobalConfig.name }),
					});

					// Redirect to new-chat
					router.push(`/dashboard/${searchSpaceId}/new-chat`);
				} catch (error) {
					console.error("Auto-configuration failed:", error);
					toast.error(t("auto_config_failed"));
					setIsAutoConfiguring(false);
				}
			}
		};

		autoConfigureWithGlobal();
	}, [
		globalConfigs,
		globalConfigsLoading,
		globalConfigsLoaded,
		preferencesLoading,
		isOnboardingComplete,
		updatePreferences,
		searchSpaceId,
		router,
		t,
	]);

	// Handle form submission
	const handleSubmit = async (formData: LLMConfigFormData) => {
		try {
			// Create the config
			const newConfig = await createConfig(formData);

			// Auto-assign to all roles
			await updatePreferences({
				search_space_id: searchSpaceId,
				data: {
					agent_llm_id: newConfig.id,
					document_summary_llm_id: newConfig.id,
				},
			});

			toast.success(t("config_created"), {
				description: t("redirecting"),
			});

			// Redirect to new-chat
			router.push(`/dashboard/${searchSpaceId}/new-chat`);
		} catch (error) {
			console.error("Failed to create config:", error);
			if (error instanceof Error) {
				toast.error(error.message || t("config_create_failed"));
			}
		}
	};

	const isSubmitting = isCreating || isUpdatingPreferences;

	// Loading state
	if (globalConfigsLoading || preferencesLoading || isAutoConfiguring) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="text-center space-y-6"
				>
					<div className="relative">
						<div className="absolute inset-0 blur-3xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-full" />
						<div className="relative flex items-center justify-center w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-2xl shadow-violet-500/25">
							<Spinner size="xl" className="text-white" />
						</div>
					</div>
					<div className="space-y-2">
						<h2 className="text-2xl font-bold tracking-tight">
							{isAutoConfiguring ? t("setting_up") : t("loading_text")}
						</h2>
						<p className="text-muted-foreground">
							{isAutoConfiguring ? t("auto_configuring") : t("please_wait")}
						</p>
					</div>
					<div className="flex justify-center gap-1">
						{[0, 1, 2].map((i) => (
							<motion.div
								key={i}
								className="w-2 h-2 rounded-full bg-violet-500"
								animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
								transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
							/>
						))}
					</div>
				</motion.div>
			</div>
		);
	}

	// If global configs exist but auto-config failed, show simple message
	if (globalConfigs.length > 0 && !isAutoConfiguring) {
		return null; // Will redirect via useEffect
	}

	// No global configs - show the config form
	return (
		<div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
			<div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					className="space-y-8"
				>
					{/* Header */}
					<div className="text-center space-y-4">
						<motion.div
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", delay: 0.2 }}
							className="relative inline-block"
						>
							<Logo className="w-20 h-20 mx-auto rounded-full" />
						</motion.div>

						<div className="space-y-2">
							<h1 className="text-3xl font-bold tracking-tight">{t("configure_title")}</h1>
							<p className="text-muted-foreground text-lg">{t("configure_desc")}</p>
						</div>
					</div>

					{/* Config Form */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 }}
					>
						<Card className="border-2 border-muted shadow-xl overflow-hidden">
							<CardHeader className="pb-4">
								<CardTitle className="text-xl">{t("llm_configuration")}</CardTitle>
							</CardHeader>
							<CardContent>
								<LLMConfigForm
									searchSpaceId={searchSpaceId}
									onSubmit={handleSubmit}
									isSubmitting={isSubmitting}
									mode="create"
									showAdvanced={true}
									submitLabel={t("start_using")}
									initialData={{
										citations_enabled: true,
										use_default_system_instructions: true,
									}}
								/>
							</CardContent>
						</Card>
					</motion.div>

					{/* Footer note */}
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
						className="text-center text-sm text-muted-foreground"
					>
						{t("can_customize_later")}{" "}
						<button
							type="button"
							onClick={() => router.push(`/dashboard/${searchSpaceId}/settings?tab=general`)}
							className="text-violet-500 hover:underline"
						>
							{t("settings_link")}
						</button>
					</motion.p>
				</motion.div>
			</div>
		</div>
	);
}
