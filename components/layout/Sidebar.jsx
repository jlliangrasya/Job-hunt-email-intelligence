"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  Search,
  Radio,
  Send,
  MessagesSquare,
  BookOpen,
  Sparkles,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { label: "Research", icon: Search, soon: true },
  { label: "Signals", icon: Radio, soon: true },
  { label: "Campaigns", icon: Send, soon: true },
  { label: "Interactions", icon: MessagesSquare, soon: true },
  { label: "Knowledge", icon: BookOpen, soon: true },
  { label: "AI Workspace", icon: Sparkles, soon: true },
  { label: "Analytics", icon: BarChart3, soon: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 flex flex-col border-r border-border bg-card shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
        <Briefcase className="size-5 text-primary" />
        <span className="font-semibold text-base tracking-tight">Job Hunt Intel</span>
      </div>
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const { label, icon: Icon, soon } = item;
          if (soon) {
            return (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-default select-none"
              >
                <Icon className="size-4" />
                {label}
                <span className="ml-auto text-[10px] uppercase tracking-wide rounded-full border border-border px-1.5 py-0.5">
                  Soon
                </span>
              </div>
            );
          }

          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="size-4 relative" />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
