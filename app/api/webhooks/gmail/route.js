import { NextResponse, after } from "next/server";
import { processWebhookEvent } from "@/lib/pipeline/process-webhook";

/**
 * Pub/Sub push endpoint — excluded from the normal auth guard (see proxy.js
 * matcher exclusion), so it authenticates itself via a shared-secret query
 * token instead. Configure the Pub/Sub push subscription's endpoint URL as
 * `<NEXT_PUBLIC_SITE_URL>/api/webhooks/gmail?token=<GMAIL_WEBHOOK_SECRET>`.
 */
export async function POST(request) {
  const token = new URL(request.url).searchParams.get("token");
  const secret = process.env.GMAIL_WEBHOOK_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dataB64 = body?.message?.data;

  if (!dataB64) {
    return NextResponse.json({ ok: true });
  }

  const decoded = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
  const { emailAddress, historyId } = decoded;

  // Ack the push immediately; Pub/Sub retries if we don't respond fast.
  after(async () => {
    try {
      await processWebhookEvent(emailAddress, historyId);
    } catch (e) {
      console.error("Webhook processing failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
