import { NextResponse, after } from "next/server";
import { processWebhookEvent } from "@/lib/pipeline/process-webhook";

/** Pub/Sub push endpoint — no auth guard (see proxy.js matcher exclusion). */
export async function POST(request) {
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
