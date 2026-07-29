"use client";
import { useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Tabbed shell for the opportunity detail page.
 *
 * Panels are rendered on the server and handed down as `tabs[].content`, so
 * switching tabs costs no round trip. Inactive panels stay mounted behind the
 * `hidden` attribute rather than unmounting, so in-progress client state (an
 * edited AI draft, an unsaved note) survives a detour to another tab.
 *
 * The active tab is mirrored into `?tab=` with replaceState so a tab is
 * linkable and survives reload without pushing history entries on every click.
 */
export function OpportunityTabs({ tabs, defaultTab }) {
  const ids = tabs.map((tab) => tab.id);
  const [active, setActive] = useState(() =>
    ids.includes(defaultTab) ? defaultTab : ids[0]
  );
  const baseId = useId();
  const tabRefs = useRef([]);

  const tabId = (id) => `${baseId}-tab-${id}`;
  const panelId = (id) => `${baseId}-panel-${id}`;

  function selectTab(id) {
    setActive(id);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  function handleKeyDown(event) {
    const current = ids.indexOf(active);
    let next = null;
    if (event.key === "ArrowRight") next = (current + 1) % ids.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + ids.length) % ids.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    if (next === null) return;

    event.preventDefault();
    selectTab(ids[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Opportunity sections"
        onKeyDown={handleKeyDown}
        className="flex gap-1 border-b border-border overflow-x-auto"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={isActive}
              aria-controls={panelId(tab.id)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "relative shrink-0 px-3 py-2 text-sm transition-colors rounded-t-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.count != null && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {tab.count}
                  </span>
                )}
              </span>
              {isActive && (
                <motion.span
                  layoutId="opportunity-tab-active"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          hidden={tab.id !== active}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
