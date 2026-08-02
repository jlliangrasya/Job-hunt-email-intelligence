import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InteractionsTimeline } from '@/components/interactions/InteractionsTimeline'

const events = [
  {
    id: '1', direction: 'sent', to_addresses: ['acme@example.com'], subject: 'Application',
    snippet: 'Applying for the role', received_at: '2026-06-01T00:00:00Z', signal_type: null,
    opportunities: { id: 'o1', organization_name: 'Acme', context_title: 'Engineer' },
  },
  {
    id: '2', direction: 'received', from_address: 'hr@globex.com', subject: 'Re: Application',
    snippet: 'We would like to interview you', received_at: '2026-06-05T00:00:00Z', signal_type: 'interview_invite',
    opportunities: { id: 'o2', organization_name: 'Globex', context_title: 'Designer' },
  },
]

test('renders all interaction events', () => {
  render(<InteractionsTimeline initialEvents={events} />)
  expect(screen.getByText(/Acme — Engineer/)).toBeInTheDocument()
  expect(screen.getByText(/Globex — Designer/)).toBeInTheDocument()
})

test('filters by direction', async () => {
  const user = userEvent.setup()
  render(<InteractionsTimeline initialEvents={events} />)
  await user.click(screen.getByRole('button', { name: /received/i }))
  expect(screen.queryByText(/Acme — Engineer/)).not.toBeInTheDocument()
  expect(screen.getByText(/Globex — Designer/)).toBeInTheDocument()
})

test('shows empty state when no events', () => {
  render(<InteractionsTimeline initialEvents={[]} />)
  expect(screen.getByText(/no interactions recorded yet/i)).toBeInTheDocument()
})
