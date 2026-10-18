import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/screens/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Spending Analytics — MoneyMind AI" },
      { name: "description", content: "Trends, categories, merchants and period comparisons." },
      { property: "og:title", content: "Spending Analytics — MoneyMind AI" },
      { property: "og:description", content: "Trends, categories, merchants and period comparisons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});
