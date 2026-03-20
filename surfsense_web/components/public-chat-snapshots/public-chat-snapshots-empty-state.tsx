"use client";

import { Link2Off } from "lucide-react";
import { useTranslations } from "next-intl";

export function PublicChatSnapshotsEmptyState() {
	const t = useTranslations("publicChatLinks");

	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<div className="rounded-full bg-muted p-3 mb-4">
				<Link2Off className="h-6 w-6 text-muted-foreground" />
			</div>
			<h3 className="text-sm font-medium text-foreground mb-1">{t("no_links")}</h3>
			<p className="text-xs text-muted-foreground max-w-sm">{t("no_links_desc")}</p>
		</div>
	);
}
