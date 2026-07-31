import { render, screen } from '@testing-library/react'
import { SignalsFeed } from '@/components/signals/SignalsFeed'

const signals = [
  {
    id: '1', signal_type: 'interview_invite', subject: 'Re: Application', snippet: 'Let’s schedule a call',
    received_at: '2026-06-05T00:00:00Z', opportunities: { id: 'o1', organization_name: 'Acme', context_title: 'Engineer' },
  },
  {
    id: '2', signal_type: 'rejection', subject: 'Re: Application', snippet: 'We moved forward with other candidates',
    received_at: '2026-06-06T00:00:00Z', opportunities: { id: 'o2', organization_name: 'Globex', context_title: 'Designer' },
  },
]

test('renders all signal rows', () => {
  render(<SignalsFeed signals={signals} />)
  expect(screen.getByText('Interview Invite')).toBeInTheDocument()
  expect(screen.getByText('Rejection')).toBeInTheDocument()
  expect(screen.getByText(/Acme — Engineer/)).toBeInTheDocument()
})

test('shows empty state when no signals', () => {
  render(<SignalsFeed signals={[]} />)
  expect(screen.getByText(/no signals detected yet/i)).toBeInTheDocument()
})
