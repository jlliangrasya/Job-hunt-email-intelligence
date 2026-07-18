import { computePriority, rankByPriority } from '@/lib/opportunity/priority'

test('offer status scores highest', () => {
  const { score, reason } = computePriority({ status: 'offer', last_activity_at: null })
  expect(score).toBeGreaterThan(0)
  expect(reason).toMatch(/offer/i)
})

test('closed statuses score zero with no reason', () => {
  for (const status of ['ghosted', 'rejected', 'withdrawn']) {
    const { score, reason } = computePriority({ status, last_activity_at: null })
    expect(score).toBe(0)
    expect(reason).toBeNull()
  }
})

test('recent activity scores higher than stale activity within the same status', () => {
  const recent = computePriority({ status: 'applied', last_activity_at: new Date().toISOString() })
  const stale = computePriority({
    status: 'applied',
    last_activity_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  })
  expect(recent.score).toBeGreaterThan(stale.score)
})

test('rankByPriority excludes closed opportunities and sorts descending', () => {
  const opportunities = [
    { id: '1', status: 'applied', last_activity_at: null },
    { id: '2', status: 'offer', last_activity_at: null },
    { id: '3', status: 'rejected', last_activity_at: null },
    { id: '4', status: 'interview', last_activity_at: null },
  ]
  const ranked = rankByPriority(opportunities, 5)
  expect(ranked.map((r) => r.opportunity.id)).toEqual(['2', '4', '1'])
})

test('rankByPriority respects the limit', () => {
  const opportunities = [
    { id: '1', status: 'offer' },
    { id: '2', status: 'interview' },
    { id: '3', status: 'replied' },
  ]
  expect(rankByPriority(opportunities, 2)).toHaveLength(2)
})
