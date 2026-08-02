import { computeInsights } from '@/lib/analytics/compute-insights'

describe('computeInsights', () => {
  test('returns null value with sample size below threshold for reply rate', () => {
    const { replyRate } = computeInsights({ opportunities: [{ id: '1' }, { id: '2' }], interactionEvents: [] })
    expect(replyRate.value).toBeNull()
    expect(replyRate.sampleSize).toBe(2)
    expect(replyRate.minSample).toBe(3)
  })

  test('computes reply rate once sample size is met', () => {
    const opportunities = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    const interactionEvents = [
      { direction: 'received', opportunity_id: '1' },
      { direction: 'received', opportunity_id: '2' },
      { direction: 'sent', opportunity_id: '3' },
    ]
    const { replyRate } = computeInsights({ opportunities, interactionEvents })
    expect(replyRate.value).toBe(50)
  })

  test('computes average days to first reply, ignoring negative diffs', () => {
    const opportunities = [
      { id: '1', initiated_at: '2026-06-01' },
      { id: '2', initiated_at: '2026-06-01' },
      { id: '3', initiated_at: '2026-06-01' },
    ]
    const interactionEvents = [
      { direction: 'received', opportunity_id: '1', received_at: '2026-06-03T00:00:00Z' },
      { direction: 'received', opportunity_id: '2', received_at: '2026-06-06T00:00:00Z' },
      { direction: 'received', opportunity_id: '3', received_at: '2026-06-04T00:00:00Z' },
    ]
    const { avgResponseTime } = computeInsights({ opportunities, interactionEvents })
    expect(avgResponseTime.value).toBe(3.3)
  })

  test('buckets priority scores into distribution', () => {
    const opportunities = [
      { id: '1', priority_score: 10 },
      { id: '2', priority_score: 40 },
      { id: '3', priority_score: 90 },
    ]
    const { priorityDistribution } = computeInsights({ opportunities })
    expect(priorityDistribution.find((b) => b.label === '0-25').count).toBe(1)
    expect(priorityDistribution.find((b) => b.label === '26-50').count).toBe(1)
    expect(priorityDistribution.find((b) => b.label === '76-100').count).toBe(1)
  })

  test('day-of-week replies stays null below minimum sample', () => {
    const interactionEvents = [{ direction: 'received', received_at: '2026-06-01T00:00:00Z' }]
    const { dayOfWeekReplies } = computeInsights({ opportunities: [], interactionEvents })
    expect(dayOfWeekReplies.value).toBeNull()
  })

  test('draft usage counts sent vs total', () => {
    const outreachDrafts = [{ was_sent: true }, { was_sent: false }, { was_sent: true }]
    const { draftUsage } = computeInsights({ outreachDrafts })
    expect(draftUsage.total).toBe(3)
    expect(draftUsage.sent).toBe(2)
  })
})
