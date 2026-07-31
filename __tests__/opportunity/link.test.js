import { linkOrCreateOpportunity, findOpportunityByThread } from '@/lib/opportunity/link'

/**
 * Minimal stand-in for the Supabase query builder. Every call records its shape
 * and defers to `handler`, which the test uses to decide what the database
 * "contains" for that particular query.
 */
function createSupabaseStub(handler) {
  const calls = []

  function from(table) {
    const state = { table, op: 'select', columns: null, payload: null, filters: [] }

    const resolve = () => {
      calls.push(state)
      return Promise.resolve(handler(state) ?? { data: null, error: null })
    }

    const builder = {
      select(columns) { state.columns = columns; return builder },
      insert(payload) { state.op = 'insert'; state.payload = payload; return builder },
      upsert(payload, options) { state.op = 'upsert'; state.payload = payload; state.options = options; return builder },
      update(payload) { state.op = 'update'; state.payload = payload; return builder },
      eq(column, value) { state.filters.push(['eq', column, value]); return builder },
      in(column, value) { state.filters.push(['in', column, value]); return builder },
      gte(column, value) { state.filters.push(['gte', column, value]); return builder },
      or(expression) { state.filters.push(['or', expression]); return builder },
      order() { return builder },
      limit(n) { state.limit = n; return builder },
      maybeSingle: resolve,
      single: resolve,
      then: (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected),
    }

    return builder
  }

  return { client: { from }, calls }
}

const hasFilter = (state, column) => state.filters.some(([, col]) => col === column)
const isThreadLookup = (state) => state.filters.some(([op]) => op === 'or')
const isDedupLookup = (state) => hasFilter(state, 'dedup_key')

const SENT_APPLICATION = {
  id: 'opp-1',
  user_id: 'user-1',
  type: 'job',
  status: 'applied',
  organization_id: 'org-1',
  organization_name: 'Acme, Inc.',
  context_title: 'Senior Software Engineer',
  channel_thread_id: 'thread-sent',
  channel_thread_ids: ['thread-sent'],
  dedup_key: 'acme|engineer-senior-software',
  initiated_at: '2026-07-10',
  subject: 'Application for Senior Software Engineer',
  recipient_email: 'hr@acme.com',
  source_email: null,
  ai_confidence: 0.9,
}

const easyApplyConfirmation = {
  userId: 'user-1',
  type: 'job',
  threadId: 'thread-linkedin',
  messageId: 'msg-linkedin',
  detectionSource: 'inbound',
  organizationName: 'Acme',
  contextTitle: 'Sr. Software Engineer',
  initiatedAt: '2026-07-08',
  subject: 'Your application was sent to Acme',
  recipientEmail: null,
  sourceEmail: 'jobs-noreply@linkedin.com',
  confidence: 0.94,
  snippet: 'Your application was sent to Acme',
}

test('a message on an already-linked thread returns the opportunity without writing', async () => {
  const { client, calls } = createSupabaseStub((state) =>
    isThreadLookup(state) ? { data: SENT_APPLICATION } : { data: null }
  )

  const result = await linkOrCreateOpportunity(client, {
    ...easyApplyConfirmation,
    threadId: 'thread-sent',
  })

  expect(result).toEqual({ opportunity: SENT_APPLICATION, created: false, linked: false })
  expect(calls.filter((c) => c.op !== 'select')).toHaveLength(0)
})

test('an Easy Apply confirmation links into the application already found in sent mail', async () => {
  const { client, calls } = createSupabaseStub((state) => {
    if (state.table === 'opportunities' && state.op === 'update') {
      return { data: { ...SENT_APPLICATION, ...state.payload } }
    }
    if (isThreadLookup(state) || isDedupLookup(state)) return { data: null }
    // Candidate scan — the exact key missed on "Sr." vs "Senior".
    if (state.table === 'opportunities') return { data: [SENT_APPLICATION] }
    return { data: null }
  })

  const { created, linked, opportunity } = await linkOrCreateOpportunity(
    client,
    easyApplyConfirmation
  )

  expect({ created, linked }).toEqual({ created: false, linked: true })
  expect(opportunity.id).toBe('opp-1')

  const update = calls.find((c) => c.op === 'update')
  expect(update.payload.channel_thread_ids).toEqual(
    expect.arrayContaining(['thread-sent', 'thread-linkedin'])
  )
  // The confirmation predates the email that created the row.
  expect(update.payload.initiated_at).toBe('2026-07-08')
  expect(update.payload.source_email).toBe('jobs-noreply@linkedin.com')
  // Never downgrade a known reply target with the board's no-reply address.
  expect(update.payload).not.toHaveProperty('recipient_email')
  // A confirmation knows less than the application it links to.
  expect(update.payload).not.toHaveProperty('context_title')
  expect(calls.some((c) => c.op === 'upsert' && c.table === 'opportunities')).toBe(false)
})

test('an Easy Apply confirmation with no matching application creates one', async () => {
  const { client, calls } = createSupabaseStub((state) => {
    if (state.table === 'organizations') return { data: { id: 'org-new' } }
    if (state.table === 'opportunities' && state.op === 'upsert') {
      return { data: { id: 'opp-new', ...state.payload } }
    }
    if (state.table === 'opportunities' && !isThreadLookup(state) && !isDedupLookup(state)) {
      return { data: [] }
    }
    return { data: null }
  })

  const { created, linked, opportunity } = await linkOrCreateOpportunity(
    client,
    easyApplyConfirmation
  )

  expect({ created, linked }).toEqual({ created: true, linked: false })
  expect(opportunity.detection_source).toBe('inbound')
  expect(opportunity.channel_thread_ids).toEqual(['thread-linkedin'])
  expect(opportunity.status).toBe('applied')
  expect(opportunity.organization_id).toBe('org-new')
  expect(opportunity.dedup_key).toBe('acme|engineer-senior-software')
  // The board's no-reply address is provenance, not an outreach target.
  expect(opportunity.recipient_email).toBeNull()
  expect(opportunity.source_email).toBe('jobs-noreply@linkedin.com')

  const upsert = calls.find((c) => c.op === 'upsert' && c.table === 'opportunities')
  expect(upsert.options).toEqual({ onConflict: 'user_id,channel_thread_id' })
})

test('a detection with no identifiable organization is stored, not merged into another', async () => {
  const { client, calls } = createSupabaseStub((state) => {
    if (state.table === 'opportunities' && state.op === 'upsert') {
      return { data: { id: 'opp-new', ...state.payload } }
    }
    return { data: null }
  })

  const { created, opportunity } = await linkOrCreateOpportunity(client, {
    ...easyApplyConfirmation,
    organizationName: 'Unknown',
    contextTitle: null,
  })

  expect(created).toBe(true)
  expect(opportunity.organization_name).toBe('Unknown')
  expect(opportunity.dedup_key).toBeNull()
  expect(opportunity.organization_id).toBeNull()
  // No identity means no candidate scan to merge against.
  expect(calls.some((c) => c.table === 'opportunities' && c.limit === 500)).toBe(false)
})

test('linking fills a missing reply address from a human sender', async () => {
  const untitled = { ...SENT_APPLICATION, recipient_email: null, organization_id: null }
  const { client, calls } = createSupabaseStub((state) => {
    if (state.table === 'organizations') return { data: { id: 'org-1' } }
    if (state.table === 'opportunities' && state.op === 'update') {
      return { data: { ...untitled, ...state.payload } }
    }
    if (isThreadLookup(state) || isDedupLookup(state)) return { data: null }
    if (state.table === 'opportunities') return { data: [untitled] }
    return { data: null }
  })

  await linkOrCreateOpportunity(client, {
    ...easyApplyConfirmation,
    recipientEmail: 'recruiter@acme.com',
    sourceEmail: 'recruiter@acme.com',
  })

  const update = calls.find((c) => c.op === 'update')
  expect(update.payload.recipient_email).toBe('recruiter@acme.com')
  expect(update.payload.organization_id).toBe('org-1')
})

test('only open applications are considered for merging, so re-applying after a rejection is new', async () => {
  const { client, calls } = createSupabaseStub((state) => {
    if (state.table === 'opportunities' && state.op === 'upsert') {
      return { data: { id: 'opp-new', ...state.payload } }
    }
    return { data: null }
  })

  await linkOrCreateOpportunity(client, easyApplyConfirmation)

  const statusFilters = calls
    .flatMap((c) => c.filters)
    .filter(([op, column]) => op === 'in' && column === 'status')

  expect(statusFilters.length).toBeGreaterThan(0)
  for (const [, , statuses] of statusFilters) {
    expect(statuses).toEqual(expect.arrayContaining(['applied', 'interview', 'offer']))
    expect(statuses).not.toContain('rejected')
    expect(statuses).not.toContain('ghosted')
    expect(statuses).not.toContain('withdrawn')
  }
})

describe('findOpportunityByThread', () => {
  test('searches the originating thread and every linked thread', async () => {
    const { client, calls } = createSupabaseStub(() => ({ data: SENT_APPLICATION }))

    const found = await findOpportunityByThread(client, 'user-1', 'thread-linkedin')

    expect(found).toBe(SENT_APPLICATION)
    const [, expression] = calls[0].filters.find(([op]) => op === 'or')
    expect(expression).toContain('channel_thread_id.eq.thread-linkedin')
    expect(expression).toContain('channel_thread_ids.cs.{thread-linkedin}')
  })

  test('rejects a thread id that could not be safely interpolated into a filter', async () => {
    const { client, calls } = createSupabaseStub(() => ({ data: SENT_APPLICATION }))

    expect(await findOpportunityByThread(client, 'user-1', 'abc,def)')).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
