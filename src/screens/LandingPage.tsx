import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  HeartPulse,
  Sparkles,
  Wallet,
  Goal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import workspaceImage from "@/assets/welcome-workspace.jpg";

const features = [
  {
    icon: ChartNoAxesCombined,
    title: "See the whole picture",
    text: "Bring your transactions together and understand where your money goes.",
    color: "bg-success-soft text-success",
  },
  {
    icon: Sparkles,
    title: "Make more mindful decisions",
    text: "Find spending patterns, plan your budgets, and look ahead with clarity.",
    color: "bg-ai-soft text-ai",
  },
  {
    icon: Goal,
    title: "Build toward what matters",
    text: "Set meaningful savings goals and keep your financial wellbeing in focus.",
    color: "bg-warning-soft text-warning-foreground",
  },
];

export function LandingPage() {
  return (
    <>
      <section className="welcome-hero relative isolate overflow-hidden">
        <img
          src={workspaceImage}
          alt="A bright workspace with a laptop showing financial charts"
          width={1536}
          height={1024}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-right"
          fetchPriority="high"
        />
        <div className="welcome-overlay absolute inset-0 -z-10" />
        <div className="mx-auto flex min-h-[590px] max-w-7xl items-center px-5 py-16 sm:px-8 lg:min-h-[640px]">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-success">
              <span className="h-px w-7 bg-success" /> YOUR FINANCIAL WELLNESS COACH
            </div>
            <h1 className="font-display text-5xl font-semibold leading-[1.12] sm:text-6xl">
              MoneyMind <span className="text-ai">AI</span>
            </h1>
            <p className="mt-5 max-w-md text-2xl font-medium leading-snug sm:text-3xl">
              Understand your money.
              <br />
              Improve your financial future.
            </p>
            <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">
              Less guesswork. More clarity. A thoughtful space to track your spending, plan ahead,
              and move closer to your goals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Start your journey <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Wallet className="size-4 text-success" /> Mindful spending
              </span>
              <span className="flex items-center gap-2">
                <HeartPulse className="size-4 text-ai" /> Financial wellbeing
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-3 md:gap-10">
          {features.map(({ icon: Icon, title, text, color }) => (
            <article key={title} className="flex items-start gap-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${color}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center">
        <div>
          <p className="mb-3 text-xs font-semibold text-success">
            SMALL STEPS. MEANINGFUL PROGRESS.
          </p>
          <h2 className="text-2xl font-semibold sm:text-3xl">
            A clearer view of your financial life.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your spending, budgets, and goals. Together in one place.
          </p>
        </div>
        <Button asChild size="lg" variant="outline">
          <Link to="/overview">
            Take a look inside <ArrowRight />
          </Link>
        </Button>
      </section>
    </>
  );
}
