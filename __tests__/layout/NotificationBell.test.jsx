import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from '@/components/layout/NotificationBell'

global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({}) })

const notifications = [
  { id: '1', title: 'Reply from Acme',  body: 'They want an interview', is_read: false },
  { id: '2', title: 'Follow-up due',    body: 'Ping Globex',            is_read: true },
]

beforeEach(() => {
  jest.clearAllMocks()
})

test('shows numeric badge when count > 0', () => {
  render(<NotificationBell count={3} notifications={[]} onMarkRead={jest.fn()} />)
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('hides badge when count is 0', () => {
  render(<NotificationBell count={0} notifications={[]} onMarkRead={jest.fn()} />)
  expect(screen.queryByText('0')).not.toBeInTheDocument()
})

test('shows 9+ when count exceeds 9', () => {
  render(<NotificationBell count={15} notifications={[]} onMarkRead={jest.fn()} />)
  expect(screen.getByText('9+')).toBeInTheDocument()
})

test('opens dropdown on button click', async () => {
  const user = userEvent.setup()
  render(<NotificationBell count={1} notifications={notifications} onMarkRead={jest.fn()} />)
  expect(screen.queryByText('Reply from Acme')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /notifications/i }))
  expect(screen.getByText('Reply from Acme')).toBeInTheDocument()
})

test('calls onMarkRead with unread ids when opened', async () => {
  const user = userEvent.setup()
  const onMarkRead = jest.fn()
  render(<NotificationBell count={1} notifications={notifications} onMarkRead={onMarkRead} />)
  await user.click(screen.getByRole('button', { name: /notifications/i }))
  expect(onMarkRead).toHaveBeenCalledWith(['1'])
})
