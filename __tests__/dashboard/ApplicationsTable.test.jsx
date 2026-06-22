import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApplicationsTable } from '@/components/dashboard/ApplicationsTable'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    channel: () => ({ on: function() { return this }, subscribe: () => ({}) }),
    removeChannel: jest.fn(),
  }),
}))

const apps = [
  { id: '1', company_name: 'Acme',   role_title: 'Engineer', status: 'applied',    application_date: '2026-06-01', last_activity_at: '2026-06-15' },
  { id: '2', company_name: 'Globex', role_title: 'Designer', status: 'interview',  application_date: '2026-06-05', last_activity_at: '2026-06-20' },
]

test('renders all application rows', () => {
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  expect(screen.getByText('Acme')).toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})

test('navigates to detail page on row click', async () => {
  const user = userEvent.setup()
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  await user.click(screen.getByText('Acme'))
  expect(mockPush).toHaveBeenCalledWith('/applications/1')
})

test('filters rows by status', async () => {
  const user = userEvent.setup()
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  await user.selectOptions(screen.getByRole('combobox'), 'interview')
  expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})

test('filters rows by search query', async () => {
  const user = userEvent.setup()
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  await user.type(screen.getByPlaceholderText(/search/i), 'Globex')
  expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})
