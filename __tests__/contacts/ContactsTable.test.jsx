import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactsTable } from '@/components/contacts/ContactsTable'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const contacts = [
  { id: '1', name: 'Jane Doe', email: 'jane@acme.com', role: 'Recruiter', organizations: { id: 'o1', name: 'Acme' } },
  { id: '2', name: 'John Roe', email: 'john@globex.com', role: 'Engineer', organizations: { id: 'o2', name: 'Globex' } },
]

test('renders all contact rows', () => {
  render(<ContactsTable initialContacts={contacts} />)
  expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  expect(screen.getByText('John Roe')).toBeInTheDocument()
})

test('navigates to detail page on row click', async () => {
  const user = userEvent.setup()
  render(<ContactsTable initialContacts={contacts} />)
  await user.click(screen.getByText('Jane Doe'))
  expect(mockPush).toHaveBeenCalledWith('/contacts/1')
})

test('filters rows by search query', async () => {
  const user = userEvent.setup()
  render(<ContactsTable initialContacts={contacts} />)
  await user.type(screen.getByPlaceholderText(/search contacts/i), 'John')
  expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
  expect(screen.getByText('John Roe')).toBeInTheDocument()
})

test('shows empty state when no contacts', () => {
  render(<ContactsTable initialContacts={[]} />)
  expect(screen.getByText(/no contacts found/i)).toBeInTheDocument()
})
