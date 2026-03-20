"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface PageUsageDisplayProps {
	pagesUsed: number;
	pagesLimit: number;
}

export function PageUsageDisplay({ pagesUsed, pagesLimit }: PageUsageDisplayProps) {
	const t = useTranslations("incentive");
	const params = useParams();
	const searchSpaceId = params.search_space_id;
	const usagePercentage = (pagesUsed / pagesLimit) * 100;

	return (
		<div className="px-3 py-3 border-t">
			<div className="space-y-2">
				<div className="flex justify-between items-center text-xs">
					<span className="text-muted-foreground">
						{t("pages_usage", {
							used: pagesUsed.toLocaleString(),
							limit: pagesLimit.toLocaleString(),
						})}
					</span>
					<span className="font-medium">{usagePercentage.toFixed(0)}%</span>
				</div>
				<Progress value={usagePercentage} className="h-1.5" />
				<Link
					href={`/dashboard/${searchSpaceId}/more-pages`}
					className="group flex items-center justify-between rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-accent"
				>
					<span className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-accent-foreground">
						<Zap className="h-3 w-3 shrink-0" />
						{t("upgrade_title")}
					</span>
					<Badge className="h-4 rounded px-1 text-[10px] font-semibold leading-none bg-emerald-600 text-white border-transparent hover:bg-emerald-600">
						{t("free_badge")}
					</Badge>
				</Link>
			</div>
		</div>
	);
}
