import { createFileRoute } from "@tanstack/react-router";
import { TransactionsPage, type TxSearch } from "@/screens/TransactionsPage";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — MoneyMind AI" },
      { name: "description", content: "Search, filter, recategorize and export your transactions." },
      { property: "og:title", content: "Transactions — MoneyMind AI" },
      { property: "og:description", content: "Search, filter, recategorize and export your transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): TxSearch => ({
    category: typeof s.category === "string" ? s.category : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    anomaly: typeof s.anomaly === "string" ? s.anomaly : undefined,
  }),
  component: TransactionsRoute,
});

function TransactionsRoute() {
  const search = Route.useSearch();
  return <TransactionsPage search={search} />;
}
