import { createFileRoute } from "@tanstack/react-router";
import { AnomaliesPage } from "@/screens/AnomaliesPage";

export const Route = createFileRoute("/anomalies")({
  head: () => ({
    meta: [
      { title: "Unusual Transactions — MoneyMind AI" },
      { name: "description", content: "Review transactions that differ from your usual patterns." },
      { property: "og:title", content: "Unusual Transactions — MoneyMind AI" },
      {
        property: "og:description",
        content: "Review transactions that differ from your usual patterns.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnomaliesPage,
});
