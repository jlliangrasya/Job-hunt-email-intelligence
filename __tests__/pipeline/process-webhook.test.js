import { processWebhookEvent } from '@/lib/pipeline/process-webhook'
import { fetchHistorySince } from '@/lib/gmail/history'
import { fetchMessage } from '@/lib/gmail/messages'
import { classifyResponse } from '@/lib/groq/classify-response'
import { classifySignalBatch } from '@/lib/groq/classify-signal'
import { findOpportunityByThread, linkOrCreateOpportunity } from '@/lib/opportunity/link'
import { createServiceClient } from '@/lib/supabase/server'

jest.mock('@/lib/gmail/history')
jest.mock('@/lib/gmail/messages')
jest.mock('@/lib/groq/classify-response')
jest.mock('@/lib/groq/classify-signal')
jest.mock('@/lib/opportunity/link')
jest.mock('@/lib/supabase/server')

/** Records every write so tests can assert what the pipeline persisted. */
function createSupabaseStub(rows = {}) {
  const writes = []

  function from(table) {
    const state = { table, op: 'select', payload: null }
    const resolve = () => {
      if (state.op !== 'select') writes.push(state)
      return Promise.resolve({ data: rows[table] ?? null, error: null })
    }
    const builder = {
      select() { return builder },
      insert(payload) { state.op = 'insert'; state.payload = payload; return builder },
      upsert(payload) { state.op = 'upsert'; state.payload = payload; return builder },
      update(payload) { state.op = 'update'; state.payload = payload; return builder },
      eq() { return builder },
      single: resolve,
      maybeSingle: resolve,
      then: (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected),
    }
    return builder
  }

  return { client: { from }, writes }
}

const CONFIRMATION = {
  id: 'msg-1',
  threadId: 'thread-linkedin',
  subject: 'Your application was sent to Acme',
  from: 'jobs-noreply@linkedin.com',
  to: 'me@example.com',
  date: 'Wed, 08 Jul 2026 10:00:00 +0000',
  snippet: 'Your application was sent to Acme',
  labelIds: ['INBOX'],
}

function setup(rows) {
  const { client, writes } = createSupabaseStub({
    user_tokens: { user_id: 'user-1' },
    gmail_watches: { history_id: '1000' },
    ...rows,
  })
  createServiceClient.mockResolvedValue(client)
  fetchHistorySince.mockResolvedValue([{ message: { id: 'msg-1' } }])
  fetchMessage.mockResolvedValue(CONFIRMATION)
  return writes
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('an inbound confirmation on an untracked thread creates the opportunity', async () => {
  const writes = setup()
  findOpportunityByThread.mockResolvedValue(null)
  classifySignalBatch.mockResolvedValue([
    {
      isOpportunity: true,
      confidence: 0.94,
      organizationName: 'Acme',
      contextTitle: 'Software Engineer',
      initiatedAt: '2026-07-08',
    },
  ])
  linkOrCreateOpportunity.mockResolvedValue({
    opportunity: { id: 'opp-new', organization_name: 'Acme' },
    created: true,
    linked: false,
  })

  await processWebhookEvent('me@example.com', '2000')

  // Classified as a confirmation, not as a reply to something we track.
  expect(classifySignalBatch).toHaveBeenCalledWith(expect.any(Array), 'job', 'inbound')
  expect(classifyResponse).not.toHaveBeenCalled()

  expect(linkOrCreateOpportunity).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      userId: 'user-1',
      threadId: 'thread-linkedin',
      detectionSource: 'inbound',
      organizationName: 'Acme',
      // A no-reply sender is provenance only, never a reply target.
      recipientEmail: null,
      sourceEmail: 'jobs-noreply@linkedin.com',
    })
  )

  const event = writes.find((w) => w.table === 'interaction_events')
  expect(event.payload).toMatchObject({
    opportunity_id: 'opp-new',
    direction: 'received',
    signal_type: 'application_confirmation',
  })
  expect(writes.find((w) => w.table === 'notifications').payload).toMatchObject({
    type: 'opportunity_detected',
    opportunity_id: 'opp-new',
  })
})

test('mail from an unrelated sender never reaches the classifier', async () => {
  const writes = setup()
  fetchMessage.mockResolvedValue({
    ...CONFIRMATION,
    from: 'newsletter@substack.com',
    subject: 'This week in tech',
  })
  findOpportunityByThread.mockResolvedValue(null)

  await processWebhookEvent('me@example.com', '2000')

  // The prefilter is what keeps realtime detection from costing an LLM call
  // per inbox message.
  expect(classifySignalBatch).not.toHaveBeenCalled()
  expect(linkOrCreateOpportunity).not.toHaveBeenCalled()
  // The history cursor still advances, so the message isn't reprocessed forever.
  expect(writes.some((w) => w.table === 'gmail_watches')).toBe(true)
})

test('a candidate the classifier rejects is not written', async () => {
  const writes = setup()
  findOpportunityByThread.mockResolvedValue(null)
  classifySignalBatch.mockResolvedValue([{ isOpportunity: false, confidence: 0.1 }])

  await processWebhookEvent('me@example.com', '2000')

  expect(classifySignalBatch).toHaveBeenCalled()
  expect(linkOrCreateOpportunity).not.toHaveBeenCalled()
  expect(writes.some((w) => w.table === 'notifications')).toBe(false)
})

test('a classifier failure does not stall the history cursor', async () => {
  const writes = setup()
  findOpportunityByThread.mockResolvedValue(null)
  classifySignalBatch.mockRejectedValue(new Error('groq timeout'))
  jest.spyOn(console, 'error').mockImplementation(() => {})

  await expect(processWebhookEvent('me@example.com', '2000')).resolves.toBeUndefined()

  // Without this the cursor would never advance and the same batch would be
  // reprocessed on every later notification.
  expect(writes.some((w) => w.table === 'gmail_watches')).toBe(true)
  console.error.mockRestore()
})

test('a low-confidence confirmation is not written', async () => {
  setup()
  findOpportunityByThread.mockResolvedValue(null)
  classifySignalBatch.mockResolvedValue([
    { isOpportunity: true, confidence: 0.5, organizationName: 'Acme' },
  ])

  await processWebhookEvent('me@example.com', '2000')

  expect(linkOrCreateOpportunity).not.toHaveBeenCalled()
})

test('a confirmation that links to a known application raises no detection notification', async () => {
  const writes = setup()
  findOpportunityByThread.mockResolvedValue(null)
  classifySignalBatch.mockResolvedValue([
    { isOpportunity: true, confidence: 0.94, organizationName: 'Acme' },
  ])
  linkOrCreateOpportunity.mockResolvedValue({
    opportunity: { id: 'opp-1', organization_name: 'Acme' },
    created: false,
    linked: true,
  })

  await processWebhookEvent('me@example.com', '2000')

  expect(writes.some((w) => w.table === 'interaction_events')).toBe(true)
  expect(writes.some((w) => w.table === 'notifications')).toBe(false)
})

test('a human reply on a tracked thread is classified as a reply and supplies the missing reply address', async () => {
  const writes = setup()
  fetchMessage.mockResolvedValue({
    ...CONFIRMATION,
    threadId: 'thread-acme',
    from: '"Dana Reyes" <dana@acme.com>',
    subject: 'Interview availability',
  })
  findOpportunityByThread.mockResolvedValue({
    id: 'opp-1',
    type: 'job',
    organization_name: 'Acme',
    context_title: 'Software Engineer',
    subject: 'Your application was sent to Acme',
    status: 'applied',
    // Detected from a board confirmation, so it has no reply target yet.
    recipient_email: null,
    follow_up_due_at: null,
  })
  classifyResponse.mockResolvedValue({
    replyType: 'interview_invite',
    confidence: 0.9,
    keyDetail: 'Tuesday 2pm',
  })

  await processWebhookEvent('me@example.com', '2000')

  expect(classifySignalBatch).not.toHaveBeenCalled()

  const update = writes.find((w) => w.table === 'opportunities')
  expect(update.payload).toMatchObject({
    status: 'interview',
    recipient_email: 'dana@acme.com',
  })
  expect(writes.find((w) => w.table === 'notifications').payload.type).toBe('interview_detected')
})

test('a reply from a no-reply address does not become the reply target', async () => {
  const writes = setup()
  fetchMessage.mockResolvedValue({ ...CONFIRMATION, threadId: 'thread-acme' })
  findOpportunityByThread.mockResolvedValue({
    id: 'opp-1',
    type: 'job',
    organization_name: 'Acme',
    context_title: null,
    subject: null,
    status: 'applied',
    recipient_email: null,
    follow_up_due_at: null,
  })
  classifyResponse.mockResolvedValue({ replyType: 'acknowledgment', confidence: 0.8 })

  await processWebhookEvent('me@example.com', '2000')

  const update = writes.find((w) => w.table === 'opportunities')
  expect(update.payload).not.toHaveProperty('recipient_email')
})
