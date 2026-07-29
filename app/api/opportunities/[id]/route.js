import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { priorityFields } from "@/lib/opportunity/priority";

const ALLOWED_UPDATE_FIELDS = [
  "status", "notes", "is_archived", "follow_up_due_at", "context_title", "organization_name",
];

/** Edits that change what the priority formula reads, so the stored score must follow. */
const PRIORITY_INPUT_FIELDS = ["status", "follow_up_due_at"];

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ opportunity: data });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates = Object.fromEntries(
    Object.entries(body).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
  );
  updates.updated_at = new Date().toISOString();

  // Keep priority_score/priority_reason in sync with manual status edits, the
  // one write path that doesn't go through discovery/webhook/cron.
  if (PRIORITY_INPUT_FIELDS.some((field) => field in updates)) {
    const { data: current } = await supabase
      .from("opportunities")
      .select("type, status, last_activity_at, follow_up_due_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (current) Object.assign(updates, priorityFields({ ...current, ...updates }));
  }

  const { data, error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunity: data });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
