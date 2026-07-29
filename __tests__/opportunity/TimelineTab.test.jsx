import { render, screen } from '@testing-library/react'
import { TimelineTab } from '@/components/opportunity/TimelineTab'

const events = [
  {
    id: 'e2',
    direction: 'received',
    from_address: 'hr@acme.com',
    subject: 'Re: Application for Senior Engineer',
    snippet: 'We would love to schedule a call.',
    signal_type: 'interview_invite',
    received_at: new Date().toISOString(),
  },
  {
    id: 'e1',
    direction: 'sent',
    to_addresses: ['hr@acme.com'],
    subject: 'Application for Senior Engineer',
    snippet: 'Please find my resume attached.',
    signal_type: null,
    received_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

test('renders an entry per stored event', () => {
  render(<TimelineTab events={events} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

test('distinguishes sent from received events', () => {
  render(<TimelineTab events={events} />)
  expect(screen.getByText(/received from hr@acme.com/i)).toBeInTheDocument()
  expect(screen.getByText(/you sent hr@acme.com/i)).toBeInTheDocument()
})

test('shows the AI signal classification when present', () => {
  render(<TimelineTab events={events} />)
  expect(screen.getByText('Interview Invite')).toBeInTheDocument()
})

test('renders snippets', () => {
  render(<TimelineTab events={events} />)
  expect(screen.getByText('We would love to schedule a call.')).toBeInTheDocument()
})

test('shows an empty state when there is no recorded activity', () => {
  render(<TimelineTab events={[]} />)
  expect(screen.getByText(/no recorded activity/i)).toBeInTheDocument()
})

test('falls back gracefully when a sent event has no recipient', () => {
  render(<TimelineTab events={[{ id: 'e3', direction: 'sent', to_addresses: [] }]} />)
  expect(screen.getByText(/you sent recipient/i)).toBeInTheDocument()
})
