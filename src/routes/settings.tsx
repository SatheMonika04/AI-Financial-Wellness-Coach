import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/screens/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MoneyMind AI" },
      { name: "description", content: "Profile, preferences, notifications and data settings." },
      { property: "og:title", content: "Settings — MoneyMind AI" },
      {
        property: "og:description",
        content: "Profile, preferences, notifications and data settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});
