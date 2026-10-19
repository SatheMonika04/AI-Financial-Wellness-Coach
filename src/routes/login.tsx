import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/screens/AccountPage";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Log in — MoneyMind AI" },
    { name: "description", content: "Return to your MoneyMind AI financial wellness journey." },
    { property: "og:title", content: "Log in — MoneyMind AI" },
    { property: "og:description", content: "Return to your MoneyMind AI financial wellness journey." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LoginPage,
});

function LoginPage() { return <AccountPage mode="login" />; }