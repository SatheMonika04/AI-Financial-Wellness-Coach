import { createFileRoute } from "@tanstack/react-router";
import { UploadPage } from "@/screens/UploadPage";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Statements — MoneyMind AI" },
      { name: "description", content: "Import CSV or PDF bank statements with automatic categorization." },
      { property: "og:title", content: "Upload Statements — MoneyMind AI" },
      { property: "og:description", content: "Import CSV or PDF bank statements with automatic categorization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});
