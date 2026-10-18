import { createFileRoute } from "@tanstack/react-router";
import { GoalsPage } from "@/screens/GoalsPage";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Financial Goals — MoneyMind AI" },
      { name: "description", content: "Track savings goals and monthly contributions." },
      { property: "og:title", content: "Financial Goals — MoneyMind AI" },
      { property: "og:description", content: "Track savings goals and monthly contributions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoalsPage,
});
