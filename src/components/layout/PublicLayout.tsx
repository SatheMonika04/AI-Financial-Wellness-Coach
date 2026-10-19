import { Link } from "@tanstack/react-router";
import { BrainCircuit, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function PublicBrand() {
  return <Link to="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="MoneyMind AI home">
    <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><BrainCircuit className="size-5" /></span>
    <span className="font-display text-base font-semibold">MoneyMind <span className="text-ai">AI</span></span>
  </Link>;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-background">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <PublicBrand />
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4">
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/overview">Explore demo <ArrowUpRight /></Link></Button>
          <Button asChild variant="ghost"><Link to="/login">Log in</Link></Button>
          <Button asChild><Link to="/signup">Get started</Link></Button>
        </nav>
      </div>
    </header>
    <main>{children}</main>
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-muted-foreground sm:px-8">
        <span>© MoneyMind AI</span><span>Understand your money. Improve your financial future.</span>
      </div>
    </footer>
  </div>;
}