"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils/date";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { NewKnowledgeItemForm } from "./NewKnowledgeItemForm";

const CATEGORIES = ["", "template", "playbook", "snippet", "note"];

export function KnowledgeGrid({ initialItems }) {
  const [items, setItems] = useState(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const router = useRouter();

  const filtered = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !category || item.category === category;
    return matchesSearch && matchesCategory;
  });

  function handleCreated(item) {
    setItems((prev) => [item, ...prev]);
    setShowNewForm(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All categories</option>
            {CATEGORIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button size="sm" onClick={() => setShowNewForm((v) => !v)} className="ml-auto gap-1.5">
            <Plus className="size-3.5" /> New
          </Button>
        </div>

        {showNewForm && (
          <NewKnowledgeItemForm onCreated={handleCreated} onCancel={() => setShowNewForm(false)} />
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <BookOpen className="size-10 opacity-40" />
            <p className="text-sm">No knowledge items found.</p>
          </div>
        ) : (
          <StaggerList as="div" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filtered.map((item) => (
              <StaggerItem
                as="div"
                key={item.id}
                onClick={() => router.push(`/knowledge/${item.id}`)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className="rounded-lg border border-border p-4 cursor-pointer flex flex-col gap-2"
              >
                <span className="self-start text-[10px] uppercase tracking-wide rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                  {item.category}
                </span>
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.body_markdown || "No content yet."}
                </p>
                <span className="text-xs text-muted-foreground mt-auto">
                  Updated {relativeTime(item.updated_at)}
                </span>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}
