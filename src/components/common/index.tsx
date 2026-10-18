import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, FlaskConical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/categories";
import { formatINR, formatPct } from "@/lib/format";
import type { AnomalyReviewStatus, AnomalySeverity, BudgetCategory, Category } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface-card animate-rise flex min-w-0 flex-col", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageIntro({ title, description, actions, badge }: { title: string; description?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-[28px]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DeltaBadge({ value, invert = false, className }: { value: number | null; invert?: boolean; className?: string }) {
  if (value == null) return <span className={cn("text-xs text-muted-foreground", className)}>No prior data</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold num", good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive", className)}>
      <Icon className="size-3" />
      {formatPct(Math.abs(value), Math.abs(value) < 0.1 ? 1 : 0)}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  invert,
  hint,
  icon: Icon,
  tone = "default",
  footer,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  invert?: boolean;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "ai" | "warning" | "destructive";
  footer?: ReactNode;
}) {
  const toneCls = {
    default: "bg-accent text-primary",
    success: "bg-success-soft text-success",
    ai: "bg-ai-soft text-ai",
    warning: "bg-warning-soft text-warning-foreground",
    destructive: "bg-destructive-soft text-destructive",
  }[tone];
  return (
    <div className="surface-card animate-rise flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", toneCls)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="font-display truncate text-[22px] font-semibold text-foreground num">{value}</div>
      <div className="flex min-h-5 flex-wrap items-center gap-1.5">
        {delta !== undefined && <DeltaBadge value={delta} invert={invert} />}
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
        {footer}
      </div>
    </div>
  );
}

export function CategoryDot({ category, className }: { category: Category | BudgetCategory; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: CATEGORY_META[category].color }} />;
}

export function CategoryBadge({ category, className }: { category: Category | BudgetCategory; className?: string }) {
  const Icon = CATEGORY_META[category].icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs font-medium text-foreground", className)}>
      <Icon className="size-3" style={{ color: CATEGORY_META[category].color }} />
      {category}
    </span>
  );
}

export function Amount({ value, type, className, compact }: { value: number; type: "income" | "expense"; className?: string; compact?: boolean }) {
  return (
    <span className={cn("font-semibold num", type === "income" ? "text-success" : "text-foreground", className)}>
      {type === "income" ? "+" : "−"}
      {formatINR(value, { compact })}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-display text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function DemoBadge({ label = "Demo data", tip = "Generated by frontend demo logic. Will be replaced by backend model output once connected." }: { label?: string; tip?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant="ai" className="cursor-help">
            <FlaskConical /> {label}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

export function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const v = severity === "high" ? "destructive" : severity === "medium" ? "warning" : "muted";
  return <Badge variant={v} className="capitalize">{severity}</Badge>;
}

export function ReviewBadge({ status }: { status: AnomalyReviewStatus }) {
  const v = status === "new" ? "ai" : status === "reviewed" ? "success" : "muted";
  return <Badge variant={v} className="capitalize">{status}</Badge>;
}

export function ConfidenceMeter({ value, threshold = 0.7 }: { value: number; threshold?: number }) {
  const low = value < threshold;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", low ? "bg-warning" : "bg-ai")} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className={cn("text-xs num", low ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>{Math.round(value * 100)}%</span>
    </div>
  );
}

export function ProgressBar({ value, status = "ok", className }: { value: number; status?: "ok" | "warning" | "over" | "success"; className?: string }) {
  const color = { ok: "bg-primary", warning: "bg-warning", over: "bg-destructive", success: "bg-success" }[status];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

type TooltipPayload = { name?: string; value?: number; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };
export function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated">
      {label != null && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}</span>
          <span className="ml-auto font-semibold text-foreground num">{typeof p.value === "number" ? formatINR(p.value) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

export const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
export const inrAxis = (v: number) => formatINR(v, { compact: true });
