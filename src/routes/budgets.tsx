import { createFileRoute } from "@tanstack/react-router";
import { BudgetsPage } from "@/screens/BudgetsPage";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Smart Budgets — MoneyMind AI" },
      { name: "description", content: "Personalized category budget recommendations." },
      { property: "og:title", content: "Smart Budgets — MoneyMind AI" },
      { property: "og:description", content: "Personalized category budget recommendations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BudgetsPage,
});
