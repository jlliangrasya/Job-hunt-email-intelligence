import { render, screen } from '@testing-library/react'
import { ThreadViewer } from '@/components/application/ThreadViewer'

const messages = [
  { id: 'm1', direction: 'sent',     from_address: 'me@gmail.com',  subject: 'Application for Engineer', snippet: 'I am applying...',     received_at: '2026-06-01T10:00:00Z', groq_reply_type: null },
  { id: 'm2', direction: 'received', from_address: 'hr@acme.com',   subject: 'Re: Application',          snippet: 'Thanks for applying!',  received_at: '2026-06-05T14:00:00Z', groq_reply_type: 'interview_invite' },
]

test('renders sender address for each message', () => {
  render(<ThreadViewer messages={messages} />)
  expect(screen.getByText('me@gmail.com')).toBeInTheDocument()
  expect(screen.getByText('hr@acme.com')).toBeInTheDocument()
})

test('renders snippet text for each message', () => {
  render(<ThreadViewer messages={messages} />)
  expect(screen.getByText('I am applying...')).toBeInTheDocument()
  expect(screen.getByText('Thanks for applying!')).toBeInTheDocument()
})

test('renders groq_reply_type label when present', () => {
  render(<ThreadViewer messages={messages} />)
  expect(screen.getByText('Interview Invite')).toBeInTheDocument()
})

test('renders empty state when no messages', () => {
  render(<ThreadViewer messages={[]} />)
  expect(screen.getByText(/no messages/i)).toBeInTheDocument()
})
