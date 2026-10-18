import { createFileRoute } from "@tanstack/react-router";
import { ForecastPage } from "@/screens/ForecastPage";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "Spending Forecast — MoneyMind AI" },
      { name: "description", content: "Predicted spending for the next 7 and 30 days." },
      { property: "og:title", content: "Spending Forecast — MoneyMind AI" },
      { property: "og:description", content: "Predicted spending for the next 7 and 30 days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForecastPage,
});
