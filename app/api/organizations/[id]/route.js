import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_UPDATE_FIELDS = ["name", "domain", "website", "industry", "size", "location", "notes"];

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !organization) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: opportunities }, { data: contacts }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, context_title, status, type, initiated_at")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .order("initiated_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name, email, role")
      .eq("organization_id", id)
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return NextResponse.json({
    organization,
    opportunities: opportunities ?? [],
    contacts: contacts ?? [],
  });
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
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organization: data });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
