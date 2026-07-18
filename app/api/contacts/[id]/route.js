import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_UPDATE_FIELDS = [
  "organization_id", "name", "email", "role", "department", "linkedin_url", "phone", "notes",
];

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*, organizations(id, name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, organization_name, context_title, status, type, initiated_at")
    .eq("contact_id", id)
    .eq("user_id", user.id)
    .order("initiated_at", { ascending: false });

  return NextResponse.json({ contact, opportunities: opportunities ?? [] });
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

  const { data, error } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
