import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/screens/OverviewPage";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — MoneyMind AI" },
      {
        name: "description",
        content: "Your income, spending, budgets and AI insights at a glance.",
      },
      { property: "og:title", content: "Overview — MoneyMind AI" },
      {
        property: "og:description",
        content: "Your income, spending, budgets and AI insights at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});
