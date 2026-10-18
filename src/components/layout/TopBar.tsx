import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Bell, CalendarRange, Settings, Wallet } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV_ITEMS } from "./nav";
import { initials } from "./AppSidebar";
import { useAppStore } from "@/store/AppStore";
import { useNotifications } from "@/hooks/useFinanceData";
import { PERIOD_OPTIONS } from "@/lib/period";
import type { PeriodKey } from "@/types";

export function PeriodSelect() {
  const { state, actions } = useAppStore();
  return (
    <Select value={state.period} onValueChange={(v) => actions.setPeriod(v as PeriodKey)}>
      <SelectTrigger className="h-9 w-[150px] bg-card" aria-label="Select period">
        <CalendarRange className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Notifications() {
  const { actions } = useAppStore();
  const { list, unread } = useNotifications();
  const navigate = useNavigate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {unread.length > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" disabled={!unread.length} onClick={() => actions.markRead(list.map((n) => n.id))}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {list.length === 0 && <p className="px-4 py-8 text-center text-xs text-muted-foreground">You're all caught up.</p>}
          {list.map((n) => {
            const isUnread = unread.some((u) => u.id === n.id);
            return (
              <button
                key={n.id}
                className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                onClick={() => {
                  actions.markRead([n.id]);
                  navigate({ to: n.link });
                }}
              >
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${n.kind === "anomaly" ? "bg-ai-soft text-ai" : "bg-warning-soft text-warning-foreground"}`}>
                  {n.kind === "anomaly" ? <AlertTriangle className="size-3.5" /> : <Wallet className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    {n.title}
                    {isUnread && <span className="size-1.5 rounded-full bg-ai" />}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const item = NAV_ITEMS.find((i) => (i.url === "/" ? path === "/" : path.startsWith(i.url)));
  const { state } = useAppStore();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
      <SidebarTrigger className="-ml-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">MoneyMind</Link>
          <span>/</span>
          <span className="truncate">{item?.group ?? "Page"}</span>
        </nav>
        <p className="font-display truncate text-[15px] font-semibold text-foreground">{item?.title ?? "MoneyMind AI"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {item?.showPeriod && (
          <div className="hidden sm:block">
            <PeriodSelect />
          </div>
        )}
        <Notifications />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Profile menu">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(state.profile.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-semibold">{state.profile.name || "Profile not set"}</p>
              <p className="text-xs font-normal text-muted-foreground">{state.profile.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
