import { render, screen } from '@testing-library/react'
import { ContactsTab } from '@/components/opportunity/ContactsTab'

const contacts = [
  { id: 'c1', name: 'Alice Chen', email: 'alice@acme.com', role: 'Engineering Manager' },
  { id: 'c2', name: null, email: 'hr@acme.com', role: null, department: 'People Ops' },
]

test('renders a row per contact', () => {
  render(<ContactsTab contacts={contacts} primaryContactId="c2" />)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

test('links each contact to its detail page', () => {
  render(<ContactsTab contacts={contacts} primaryContactId="c2" />)
  expect(screen.getByRole('link', { name: /alice chen/i })).toHaveAttribute('href', '/contacts/c1')
})

test('marks the opportunity contact as primary', () => {
  render(<ContactsTab contacts={contacts} primaryContactId="c2" />)
  expect(screen.getByText('Primary')).toBeInTheDocument()
})

test('sorts the primary contact first', () => {
  render(<ContactsTab contacts={contacts} primaryContactId="c2" />)
  const [first] = screen.getAllByRole('listitem')
  expect(first).toHaveTextContent('hr@acme.com')
})

test('falls back to email when a contact has no name', () => {
  render(<ContactsTab contacts={contacts} primaryContactId="c2" />)
  expect(screen.getByRole('link', { name: /hr@acme.com/i })).toBeInTheDocument()
})

test('falls back to department when a contact has no role', () => {
  render(<ContactsTab contacts={contacts} primaryContactId="c2" />)
  expect(screen.getByText('People Ops')).toBeInTheDocument()
})

test('shows an empty state when nothing is linked', () => {
  render(<ContactsTab contacts={[]} primaryContactId={null} />)
  expect(screen.getByText(/no contacts linked/i)).toBeInTheDocument()
})
