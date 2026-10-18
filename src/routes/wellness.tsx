import { createFileRoute } from "@tanstack/react-router";
import { WellnessPage } from "@/screens/WellnessPage";

export const Route = createFileRoute("/wellness")({
  head: () => ({
    meta: [
      { title: "Financial Wellness — MoneyMind AI" },
      { name: "description", content: "Your financial wellness score and action plan." },
      { property: "og:title", content: "Financial Wellness — MoneyMind AI" },
      { property: "og:description", content: "Your financial wellness score and action plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WellnessPage,
});
