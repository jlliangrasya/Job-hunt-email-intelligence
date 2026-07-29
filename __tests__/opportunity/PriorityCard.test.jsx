import { render, screen } from '@testing-library/react'
import { PriorityCard } from '@/components/opportunity/PriorityCard'

test('renders the live score and reason for an open opportunity', () => {
  render(<PriorityCard opportunity={{ type: 'job', status: 'offer', last_activity_at: null }} />)
  const meter = screen.getByRole('meter', { name: /priority score/i })
  expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  expect(screen.getByText(/respond soon/i)).toBeInTheDocument()
})

test('ranks an offer above an application in the meter', () => {
  const { unmount } = render(
    <PriorityCard opportunity={{ type: 'job', status: 'offer', last_activity_at: null }} />
  )
  const offer = Number(screen.getByRole('meter').getAttribute('aria-valuenow'))
  unmount()

  render(<PriorityCard opportunity={{ type: 'job', status: 'applied', last_activity_at: null }} />)
  const applied = Number(screen.getByRole('meter').getAttribute('aria-valuenow'))
  expect(offer).toBeGreaterThan(applied)
})

test('shows a closed state instead of a meter for closed statuses', () => {
  render(<PriorityCard opportunity={{ type: 'job', status: 'rejected', last_activity_at: null }} />)
  expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  expect(screen.getByText(/excluded from priority ranking/i)).toBeInTheDocument()
})

test('notes how overdue a follow-up is', () => {
  render(
    <PriorityCard
      opportunity={{
        type: 'job',
        status: 'follow_up_due',
        last_activity_at: null,
        follow_up_due_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      }}
    />
  )
  expect(screen.getByText(/4d overdue/)).toBeInTheDocument()
})

test('never exceeds the meter maximum', () => {
  render(
    <PriorityCard
      opportunity={{
        type: 'job',
        status: 'offer',
        last_activity_at: new Date().toISOString(),
        follow_up_due_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      }}
    />
  )
  const meter = screen.getByRole('meter')
  expect(Number(meter.getAttribute('aria-valuenow')))
    .toBeLessThanOrEqual(Number(meter.getAttribute('aria-valuemax')))
})
