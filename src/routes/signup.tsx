import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/screens/AccountPage";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — MoneyMind AI" },
      { name: "description", content: "Start a more mindful financial journey with MoneyMind AI." },
      { property: "og:title", content: "Sign up — MoneyMind AI" },
      {
        property: "og:description",
        content: "Start a more mindful financial journey with MoneyMind AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return <AccountPage mode="signup" />;
}
