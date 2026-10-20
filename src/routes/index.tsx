import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/screens/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoneyMind AI — Financial wellness coach" },
      {
        name: "description",
        content: "A clearer view of your money, goals, and long-term wellbeing.",
      },
      { property: "og:title", content: "MoneyMind AI — Financial wellness coach" },
      {
        property: "og:description",
        content: "A clearer view of your money, goals, and long-term wellbeing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
