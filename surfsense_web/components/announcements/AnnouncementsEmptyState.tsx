"use client";

import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";

export function AnnouncementsEmptyState() {
	const t = useTranslations("announcements");
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
				<BellOff className="h-7 w-7 text-muted-foreground" />
			</div>
			<h3 className="text-lg font-semibold">{t("no_announcements")}</h3>
			<p className="mt-1 text-sm text-muted-foreground max-w-sm">{t("all_caught_up")}</p>
		</div>
	);
}
