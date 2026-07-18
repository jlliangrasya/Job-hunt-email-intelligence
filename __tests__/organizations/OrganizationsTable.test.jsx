import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrganizationsTable } from '@/components/organizations/OrganizationsTable'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const organizations = [
  { id: '1', name: 'Acme',   industry: 'Software', size: '50-200', location: 'Remote' },
  { id: '2', name: 'Globex', industry: 'Finance',   size: '1000+', location: 'NYC' },
]

test('renders all organization rows', () => {
  render(<OrganizationsTable initialOrganizations={organizations} />)
  expect(screen.getByText('Acme')).toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})

test('navigates to detail page on row click', async () => {
  const user = userEvent.setup()
  render(<OrganizationsTable initialOrganizations={organizations} />)
  await user.click(screen.getByText('Acme'))
  expect(mockPush).toHaveBeenCalledWith('/organizations/1')
})

test('filters rows by search query', async () => {
  const user = userEvent.setup()
  render(<OrganizationsTable initialOrganizations={organizations} />)
  await user.type(screen.getByPlaceholderText(/search organizations/i), 'Globex')
  expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})

test('shows empty state when no organizations', () => {
  render(<OrganizationsTable initialOrganizations={[]} />)
  expect(screen.getByText(/no organizations found/i)).toBeInTheDocument()
})
