import { createClient } from "@/lib/supabase/server";
import { discoverOpportunities } from "@/lib/gmail/scan";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { type = "job" } = await request.json().catch(() => ({}));

  const { data: settings } = await supabase
    .from("user_settings")
    .select("detection_lookback_days")
    .eq("user_id", user.id)
    .single();

  const lookbackDays = settings?.detection_lookback_days ?? 90;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const progress of discoverOpportunities(user.id, type, lookbackDays)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Scan failed:", e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
