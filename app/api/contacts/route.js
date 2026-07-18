import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const organizationId = searchParams.get("organization_id");

  let query = supabase
    .from("contacts")
    .select("*, organizations(id, name)")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (search) query = query.ilike("name", `%${search}%`);
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      organization_id: body.organization_id ?? null,
      name: body.name ?? null,
      email: body.email ?? null,
      role: body.role ?? null,
      department: body.department ?? null,
      linkedin_url: body.linkedin_url ?? null,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
