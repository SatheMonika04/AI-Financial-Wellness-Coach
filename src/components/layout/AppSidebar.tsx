import { Link, useRouterState } from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV_ITEMS, type NavItem } from "./nav";
import { useAppStore } from "@/store/AppStore";

const GROUPS: NavItem["group"][] = ["Money", "AI Insights", "Plan", "Account"];

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppSidebar() {
  const { state: sb, setOpenMobile } = useSidebar();
  const collapsed = sb === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useAppStore();
  const newAnomalies = state.transactions.filter((t) => t.anomaly?.flagged && t.anomaly.reviewStatus === "new").length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpenMobile(false)}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-sm">
            <BrainCircuit className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="font-display block text-[15px] font-semibold text-sidebar-foreground">MoneyMind <span className="text-ai">AI</span></span>
              <span className="block truncate text-[11px] text-muted-foreground">Financial wellness coach</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((g) => (
          <SidebarGroup key={g}>
            <SidebarGroupLabel>{g}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.filter((i) => i.group === g).map((item) => {
                  const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold">
                        <Link to={item.url} onClick={() => setOpenMobile(false)}>
                          <item.icon className={active ? "text-ai" : ""} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.url === "/anomalies" && newAnomalies > 0 && <SidebarMenuBadge className="bg-ai-soft text-ai">{newAnomalies}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Link to="/settings" onClick={() => setOpenMobile(false)} className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(state.profile.name)}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-sidebar-foreground">{state.profile.name || "Your profile"}</span>
              <span className="block truncate text-[11px] text-muted-foreground">Personal workspace</span>
            </span>
          )}
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
