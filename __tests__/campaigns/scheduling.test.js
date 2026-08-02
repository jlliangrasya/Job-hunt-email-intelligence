import { resolveNextStep, computeDueAt } from '@/lib/campaigns/scheduling'

const steps = [
  { step_order: 1, label: 'Follow up', scenario: 'follow_up', delay_days: 3 },
  { step_order: 2, label: 'Check in', scenario: 'follow_up', delay_days: 5 },
  { step_order: 3, label: 'Final nudge', scenario: 'follow_up', delay_days: 7 },
]

describe('resolveNextStep', () => {
  test('returns the first step when nothing has run yet', () => {
    expect(resolveNextStep(steps, 0)).toEqual(steps[0])
  })

  test('returns the next step mid-sequence', () => {
    expect(resolveNextStep(steps, 1)).toEqual(steps[1])
  })

  test('returns null once the sequence is exhausted', () => {
    expect(resolveNextStep(steps, 3)).toBeNull()
  })

  test('sorts by step_order regardless of input order', () => {
    const shuffled = [steps[2], steps[0], steps[1]]
    expect(resolveNextStep(shuffled, 0)).toEqual(steps[0])
  })

  test('returns null for an empty step list', () => {
    expect(resolveNextStep([], 0)).toBeNull()
  })
})

describe('computeDueAt', () => {
  test('adds delay_days to the given date', () => {
    const from = new Date('2026-06-01T00:00:00Z')
    const due = computeDueAt({ delay_days: 5 }, from)
    expect(due).toBe('2026-06-06T00:00:00.000Z')
  })

  test('accepts an ISO string as the from-date', () => {
    const due = computeDueAt({ delay_days: 3 }, '2026-06-01T00:00:00Z')
    expect(due).toBe('2026-06-04T00:00:00.000Z')
  })
})
