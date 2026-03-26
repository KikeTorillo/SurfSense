"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import type { FC } from "react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EnumConnectorName } from "@/contracts/enums/connector";
import { getConnectorBenefits } from "../connector-benefits";
import type { ConnectFormProps } from "../index";

const braveSearchApiFormSchema = z.object({
	name: z.string().min(3, {
		message: "Connector name must be at least 3 characters.",
	}),
	api_key: z.string().min(10, {
		message: "API key is required and must be valid.",
	}),
});

type BraveSearchApiFormValues = z.infer<typeof braveSearchApiFormSchema>;

export const BraveSearchApiConnectForm: FC<ConnectFormProps> = ({ onSubmit, isSubmitting }) => {
	const isSubmittingRef = useRef(false);
	const form = useForm<BraveSearchApiFormValues>({
		resolver: zodResolver(braveSearchApiFormSchema),
		defaultValues: {
			name: "Brave Search Connector",
			api_key: "",
		},
	});

	const handleSubmit = async (values: BraveSearchApiFormValues) => {
		// Prevent multiple submissions
		if (isSubmittingRef.current || isSubmitting) {
			return;
		}

		isSubmittingRef.current = true;
		try {
			await onSubmit({
				name: values.name,
				connector_type: EnumConnectorName.BRAVE_SEARCH_API,
				config: {
					BRAVE_API_KEY: values.api_key,
				},
				is_indexable: false,
				is_active: true,
				last_indexed_at: null,
				periodic_indexing_enabled: false,
				indexing_frequency_minutes: null,
				next_scheduled_at: null,
			});
		} finally {
			isSubmittingRef.current = false;
		}
	};

	return (
		<div className="space-y-6 pb-6">
			<Alert className="bg-slate-400/5 dark:bg-white/5 border-slate-400/20 p-2 sm:p-3">
				<Info className="size-4 shrink-0" />
				<AlertTitle className="text-xs sm:text-sm">API Key Required</AlertTitle>
				<AlertDescription className="text-[10px] sm:text-xs">
					You'll need a Brave Search API key to use this connector. You can get one at{" "}
					<a
						href="https://brave.com/search/api/"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium underline underline-offset-4"
					>
						brave.com/search/api
					</a>
				</AlertDescription>
			</Alert>

			<div className="rounded-xl border border-border bg-slate-400/5 dark:bg-white/5 p-3 sm:p-6 space-y-3 sm:space-y-4">
				<Form {...form}>
					<form
						id="brave-search-api-connect-form"
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4 sm:space-y-6"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs sm:text-sm">Connector Name</FormLabel>
									<FormControl>
										<Input
											placeholder="My Brave Search Connector"
											className="border-slate-400/20 focus-visible:border-slate-400/40"
											disabled={isSubmitting}
											{...field}
										/>
									</FormControl>
									<FormDescription className="text-[10px] sm:text-xs">
										A friendly name to identify this connector.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="api_key"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs sm:text-sm">Brave Search API Key</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Enter your Brave Search API key"
											className="border-slate-400/20 focus-visible:border-slate-400/40"
											disabled={isSubmitting}
											{...field}
										/>
									</FormControl>
									<FormDescription className="text-[10px] sm:text-xs">
										Your API key will be encrypted and stored securely.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>
			</div>

			{/* What you get section */}
			{getConnectorBenefits(EnumConnectorName.BRAVE_SEARCH_API) && (
				<div className="rounded-xl border border-border bg-slate-400/5 dark:bg-white/5 px-3 sm:px-6 py-4 space-y-2">
					<h4 className="text-xs sm:text-sm font-medium">What you get with Brave Search:</h4>
					<ul className="list-disc pl-5 text-[10px] sm:text-xs text-muted-foreground space-y-1">
						{getConnectorBenefits(EnumConnectorName.BRAVE_SEARCH_API)?.map((benefit) => (
							<li key={benefit}>{benefit}</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};
