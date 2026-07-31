"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { NewCampaignForm } from "./NewCampaignForm";

export function CampaignsGrid({ initialCampaigns }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const router = useRouter();

  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  function handleCreated(campaign) {
    setCampaigns((prev) => [campaign, ...prev]);
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
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button size="sm" onClick={() => setShowNewForm((v) => !v)} className="ml-auto gap-1.5">
            <Plus className="size-3.5" /> New
          </Button>
        </div>

        {showNewForm && (
          <NewCampaignForm onCreated={handleCreated} onCancel={() => setShowNewForm(false)} />
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Send className="size-10 opacity-40" />
            <p className="text-sm">No campaigns found.</p>
          </div>
        ) : (
          <StaggerList as="div" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filtered.map((campaign) => (
              <StaggerItem
                as="div"
                key={campaign.id}
                onClick={() => router.push(`/campaigns/${campaign.id}`)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className="rounded-lg border border-border p-4 cursor-pointer flex flex-col gap-2"
              >
                <h3 className="text-sm font-medium">{campaign.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {campaign.description || "No description."}
                </p>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}
