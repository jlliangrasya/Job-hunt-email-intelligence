import { discoverOpportunities } from '@/lib/gmail/scan'
import { getValidGmailClient } from '@/lib/gmail/token-manager'
import { classifySignalBatch } from '@/lib/groq/classify-signal'
import { linkOrCreateOpportunity } from '@/lib/opportunity/link'
import { createServiceClient } from '@/lib/supabase/server'

jest.mock('@/lib/gmail/token-manager')
jest.mock('@/lib/groq/classify-signal')
jest.mock('@/lib/opportunity/link')
jest.mock('@/lib/supabase/server')

/** Gmail stub returning one message per direction, keyed by the query issued. */
function mockGmail() {
  const queries = []

  const messagesById = {
    'sent-1': {
      id: 'sent-1',
      threadId: 'thread-sent',
      snippet: 'Please find my application attached',
      payload: {
        headers: [
          { name: 'Subject', value: 'Application for Software Engineer' },
          { name: 'To', value: 'hr@acme.com' },
          { name: 'Date', value: 'Wed, 08 Jul 2026 10:00:00 +0000' },
        ],
      },
    },
    'inbound-1': {
      id: 'inbound-1',
      threadId: 'thread-linkedin',
      snippet: 'Your application was sent to Beta Corp',
      payload: {
        headers: [
          { name: 'Subject', value: 'Your application was sent to Beta Corp' },
          { name: 'From', value: 'jobs-noreply@linkedin.com' },
          { name: 'Date', value: 'Thu, 09 Jul 2026 10:00:00 +0000' },
        ],
      },
    },
  }

  const gmail = {
    users: {
      messages: {
        list: jest.fn(async ({ q }) => {
          queries.push(q)
          const id = q.startsWith('in:sent') ? 'sent-1' : 'inbound-1'
          return { data: { messages: [{ id }] } }
        }),
        get: jest.fn(async ({ id }) => ({ data: messagesById[id] })),
      },
    },
  }

  getValidGmailClient.mockResolvedValue({ gmail })
  return { gmail, queries }
}

function stubSupabase() {
  const builder = {
    from: jest.fn(() => builder),
    update: jest.fn(() => builder),
    eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
  }
  createServiceClient.mockResolvedValue(builder)
  return builder
}

beforeEach(() => {
  jest.clearAllMocks()
  stubSupabase()
  linkOrCreateOpportunity.mockResolvedValue({
    opportunity: { id: 'opp-1' },
    created: true,
    linked: false,
  })
  classifySignalBatch.mockResolvedValue([
    {
      isOpportunity: true,
      confidence: 0.95,
      organizationName: 'Acme',
      contextTitle: 'Software Engineer',
      initiatedAt: null,
    },
  ])
})

async function drain(generator) {
  const progress = []
  for await (const event of generator) progress.push(event)
  return progress
}

test('scans both the sent folder and inbound confirmations', async () => {
  const { queries } = mockGmail()

  const progress = await drain(discoverOpportunities('user-1', 'job', 90))

  expect(queries).toHaveLength(2)
  expect(queries[0]).toContain('in:sent')
  expect(queries[1]).toContain('-in:sent')
  expect(queries.every((q) => q.includes('after:'))).toBe(true)

  // Both passes are counted into `total` up front so the progress bar never
  // jumps backwards when the second pass begins.
  expect(progress).toEqual([
    { scanned: 1, total: 2, detected: 1, failed: 0 },
    { scanned: 2, total: 2, detected: 2, failed: 0 },
  ])
})

test('classifies each direction with its own prompt and counterparty header', async () => {
  mockGmail()

  await drain(discoverOpportunities('user-1', 'job', 90))

  expect(classifySignalBatch).toHaveBeenNthCalledWith(
    1,
    [expect.objectContaining({ to: 'hr@acme.com', from: '' })],
    'job',
    'sent'
  )
  expect(classifySignalBatch).toHaveBeenNthCalledWith(
    2,
    [expect.objectContaining({ from: 'jobs-noreply@linkedin.com', to: '' })],
    'job',
    'inbound'
  )
})

test('an inbound confirmation records its no-reply sender as provenance, not a reply target', async () => {
  mockGmail()

  await drain(discoverOpportunities('user-1', 'job', 90))

  const [, inbound] = linkOrCreateOpportunity.mock.calls.map(([, detection]) => detection)
  expect(inbound).toMatchObject({
    detectionSource: 'inbound',
    threadId: 'thread-linkedin',
    recipientEmail: null,
    sourceEmail: 'jobs-noreply@linkedin.com',
  })

  const [sent] = linkOrCreateOpportunity.mock.calls.map(([, detection]) => detection)
  expect(sent).toMatchObject({
    detectionSource: 'sent',
    threadId: 'thread-sent',
    recipientEmail: 'hr@acme.com',
  })
})

test('a thread already linked to an application is not counted as a new detection', async () => {
  mockGmail()
  linkOrCreateOpportunity.mockResolvedValue({
    opportunity: { id: 'opp-1' },
    created: false,
    linked: true,
  })

  const progress = await drain(discoverOpportunities('user-1', 'job', 90))

  expect(progress.at(-1)).toEqual({ scanned: 2, total: 2, detected: 0, failed: 0 })
})

// A scan that cannot write is not a scan that found nothing. Reporting one as
// the other is how an unapplied migration hid behind a clean "0 detected" run
// and a completed-looking onboarding.
describe('when writes are rejected', () => {
  // These paths log every rejected write by design; silence it so a passing run
  // does not look like a failing one.
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => console.error.mockRestore())

  const rejectWrites = () =>
    linkOrCreateOpportunity.mockRejectedValue(
      new Error('Opportunity upsert failed: column "channel_thread_ids" does not exist')
    )

  test('the scan fails loudly instead of reporting an empty mailbox', async () => {
    mockGmail()
    rejectWrites()

    await expect(drain(discoverOpportunities('user-1', 'job', 90))).rejects.toThrow(
      /could not save any of 2 detected opportunities.*channel_thread_ids/s
    )
  })

  test('initial discovery is not marked complete, so the next run retries', async () => {
    mockGmail()
    rejectWrites()
    const supabase = stubSupabase()

    await drain(discoverOpportunities('user-1', 'job', 90)).catch(() => {})

    expect(supabase.update).not.toHaveBeenCalled()
  })

  test('one bad message does not abort a scan that is otherwise working', async () => {
    mockGmail()
    linkOrCreateOpportunity
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue({ opportunity: { id: 'opp-2' }, created: true, linked: false })

    const progress = await drain(discoverOpportunities('user-1', 'job', 90))

    expect(progress.at(-1)).toEqual({ scanned: 2, total: 2, detected: 1, failed: 1 })
  })
})

test('an unparseable model date falls back to the message header, not to today', async () => {
  mockGmail()
  classifySignalBatch.mockResolvedValue([
    { isOpportunity: true, confidence: 0.95, organizationName: 'Acme', initiatedAt: 'last Tuesday' },
  ])

  await drain(discoverOpportunities('user-1', 'job', 90))

  const [sent] = linkOrCreateOpportunity.mock.calls.map(([, detection]) => detection)
  expect(sent.initiatedAt).toBe('Wed, 08 Jul 2026 10:00:00 +0000')
})

test('a parseable model date is preferred over the message header', async () => {
  mockGmail()
  classifySignalBatch.mockResolvedValue([
    { isOpportunity: true, confidence: 0.95, organizationName: 'Acme', initiatedAt: '2026-07-01' },
  ])

  await drain(discoverOpportunities('user-1', 'job', 90))

  const [sent] = linkOrCreateOpportunity.mock.calls.map(([, detection]) => detection)
  expect(sent.initiatedAt).toBe('2026-07-01')
})

test('an unparseable sender is stored as null rather than an empty string', async () => {
  const { gmail } = mockGmail()
  gmail.users.messages.get.mockImplementation(async () => ({
    data: {
      id: 'inbound-1',
      threadId: 'thread-linkedin',
      snippet: 'Your application was sent',
      payload: {
        headers: [
          { name: 'Subject', value: 'Your application was sent to Acme' },
          { name: 'From', value: 'LinkedIn Jobs' },
          { name: 'Date', value: 'Thu, 09 Jul 2026 10:00:00 +0000' },
        ],
      },
    },
  }))

  await drain(discoverOpportunities('user-1', 'job', 90))

  for (const [, detection] of linkOrCreateOpportunity.mock.calls) {
    expect(detection.sourceEmail).toBeNull()
    // NULL, never "" — an empty string reads as a real address to the UI.
    expect(detection.recipientEmail).toBeNull()
  }
})

test('low-confidence classifications are skipped', async () => {
  mockGmail()
  classifySignalBatch.mockResolvedValue([{ isOpportunity: true, confidence: 0.5 }])

  const progress = await drain(discoverOpportunities('user-1', 'job', 90))

  expect(linkOrCreateOpportunity).not.toHaveBeenCalled()
  expect(progress.at(-1).detected).toBe(0)
})
