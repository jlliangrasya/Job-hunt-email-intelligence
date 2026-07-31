import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeGrid } from '@/components/knowledge/KnowledgeGrid'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const items = [
  { id: '1', title: 'Follow-up Template', category: 'template', body_markdown: 'Hi {{name}}...', updated_at: '2026-06-01T00:00:00Z' },
  { id: '2', title: 'Interview Playbook', category: 'playbook', body_markdown: 'Prep checklist...', updated_at: '2026-06-05T00:00:00Z' },
]

test('renders all knowledge items', () => {
  render(<KnowledgeGrid initialItems={items} />)
  expect(screen.getByText('Follow-up Template')).toBeInTheDocument()
  expect(screen.getByText('Interview Playbook')).toBeInTheDocument()
})

test('navigates to detail page on card click', async () => {
  const user = userEvent.setup()
  render(<KnowledgeGrid initialItems={items} />)
  await user.click(screen.getByText('Follow-up Template'))
  expect(mockPush).toHaveBeenCalledWith('/knowledge/1')
})

test('filters items by search query', async () => {
  const user = userEvent.setup()
  render(<KnowledgeGrid initialItems={items} />)
  await user.type(screen.getByPlaceholderText(/search knowledge base/i), 'Interview')
  expect(screen.queryByText('Follow-up Template')).not.toBeInTheDocument()
  expect(screen.getByText('Interview Playbook')).toBeInTheDocument()
})

test('shows empty state when no items', () => {
  render(<KnowledgeGrid initialItems={[]} />)
  expect(screen.getByText(/no knowledge items found/i)).toBeInTheDocument()
})
