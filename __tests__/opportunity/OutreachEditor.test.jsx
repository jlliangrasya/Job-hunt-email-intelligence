import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OutreachEditor } from '@/components/opportunity/OutreachEditor'

const draft = {
  id: 'd1', scenario: 'follow_up', subject: 'Following up',
  body_markdown: 'Hi, just checking in...', body_edited: null, was_sent: false,
}

test('renders subject and body text', () => {
  render(<OutreachEditor draft={draft} onUpdate={jest.fn()} onSend={jest.fn()} sending={false} />)
  expect(screen.getByText('Following up')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Hi, just checking in...')).toBeInTheDocument()
})

test('calls onUpdate when textarea changes', async () => {
  const user = userEvent.setup()
  const onUpdate = jest.fn()
  render(<OutreachEditor draft={draft} onUpdate={onUpdate} onSend={jest.fn()} sending={false} />)
  const textarea = screen.getByDisplayValue('Hi, just checking in...')
  await user.clear(textarea)
  await user.type(textarea, 'New body')
  expect(onUpdate).toHaveBeenLastCalledWith('New body')
})

test('calls onSend on Send Email button click', async () => {
  const user = userEvent.setup()
  const onSend = jest.fn()
  render(<OutreachEditor draft={draft} onUpdate={jest.fn()} onSend={onSend} sending={false} />)
  await user.click(screen.getByRole('button', { name: /send email/i }))
  expect(onSend).toHaveBeenCalled()
})

test('shows Sent state and hides send button when was_sent is true', () => {
  render(<OutreachEditor draft={{ ...draft, was_sent: true }} onUpdate={jest.fn()} onSend={jest.fn()} sending={false} />)
  expect(screen.getByText(/sent/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /send email/i })).not.toBeInTheDocument()
})
