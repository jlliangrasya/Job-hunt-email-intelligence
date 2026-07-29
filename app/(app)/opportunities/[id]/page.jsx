import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchThread } from "@/lib/gmail/messages";
import { OpportunityMeta } from "@/components/opportunity/OpportunityMeta";
import { OpportunityTabs } from "@/components/opportunity/OpportunityTabs";
import { PriorityCard } from "@/components/opportunity/PriorityCard";
import { ThreadViewer } from "@/components/opportunity/ThreadViewer";
import { TimelineTab } from "@/components/opportunity/TimelineTab";
import { ContactsTab } from "@/components/opportunity/ContactsTab";
import { NotesTab } from "@/components/opportunity/NotesTab";
import { OutreachPanel } from "@/components/opportunity/OutreachPanel";

/**
 * Loads the Gmail thread directly rather than through /api/opportunities/[id]/thread.
 * A server-side fetch to our own route would carry no auth cookies, so the route
 * would reject it — and the extra hop buys nothing when we already have a
 * server Supabase client here. The route stays for client-side consumers.
 */
async function loadThread(supabase, userId, opportunity) {
  if (!opportunity.channel_thread_id) return [];

  let threadMessages;
  try {
    threadMessages = await fetchThread(userId, opportunity.channel_thread_id);
  } catch (e) {
    console.error("Thread fetch failed:", e);
    return [];
  }

  const { data: events } = await supabase
    .from("interaction_events")
    .select("channel_message_id, signal_type")
    .eq("opportunity_id", opportunity.id);

  const signalByMessageId = new Map(
    (events ?? []).map((e) => [e.channel_message_id, e.signal_type])
  );

  return threadMessages.map((msg) => ({
    id: msg.id,
    subject: msg.subject,
    from_address: msg.from,
    snippet: msg.snippet,
    received_at: msg.date,
    direction: msg.labelIds.includes("SENT") ? "sent" : "received",
    signal_type: signalByMessageId.get(msg.id) ?? null,
  }));
}

/** Contacts addressed by this opportunity plus everyone else at its organization. */
async function loadContacts(supabase, userId, opportunity) {
  const filters = [];
  if (opportunity.organization_id) filters.push(`organization_id.eq.${opportunity.organization_id}`);
  if (opportunity.contact_id) filters.push(`id.eq.${opportunity.contact_id}`);
  if (!filters.length) return [];

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .or(filters.join(","))
    .order("name", { ascending: true, nullsFirst: false });

  return data ?? [];
}

export default async function OpportunityDetailPage({ params, searchParams }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const user = authUser ?? (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true"
    ? { id: "00000000-0000-0000-0000-000000000000", email: "preview@dev.local" }
    : null);

  if (!user) redirect("/login");

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) notFound();

  const [messages, contacts, { data: events }, { data: drafts }] = await Promise.all([
    loadThread(supabase, user.id, opportunity),
    loadContacts(supabase, user.id, opportunity),
    supabase
      .from("interaction_events")
      .select("*")
      .eq("opportunity_id", id)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false }),
    supabase
      .from("outreach_drafts")
      .select("*")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="flex flex-col gap-4">
          <OpportunityMeta opportunity={opportunity} />
          <PriorityCard opportunity={opportunity} />
        </div>
      ),
    },
    {
      id: "thread",
      label: "Thread",
      count: messages.length || null,
      content: <ThreadViewer messages={messages} />,
    },
    {
      id: "timeline",
      label: "Timeline",
      count: events?.length || null,
      content: <TimelineTab events={events ?? []} />,
    },
    {
      id: "contacts",
      label: "Contacts",
      count: contacts.length || null,
      content: <ContactsTab contacts={contacts} primaryContactId={opportunity.contact_id} />,
    },
    {
      id: "ai",
      label: "AI Drafts",
      count: drafts?.length || null,
      content: (
        <OutreachPanel
          opportunityId={id}
          type={opportunity.type}
          initialDrafts={drafts ?? []}
        />
      ),
    },
    {
      id: "notes",
      label: "Notes",
      content: <NotesTab opportunityId={id} initialNotes={opportunity.notes} />,
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">
          {opportunity.organization_name ?? "Unknown Organization"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {opportunity.context_title ?? "Untitled opportunity"}
        </p>
      </div>
      <OpportunityTabs tabs={tabs} defaultTab={tab} />
    </div>
  );
}
