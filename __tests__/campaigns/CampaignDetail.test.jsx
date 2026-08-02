import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignDetail } from '@/components/campaigns/CampaignDetail'

const campaign = { id: 'c1', name: 'Follow-up Sequence', description: 'Standard follow-up' }
const steps = [
  { id: 's1', step_order: 1, label: 'Initial follow-up', scenario: 'follow_up', delay_days: 3 },
  { id: 's2', step_order: 2, label: 'Check in', scenario: 'follow_up', delay_days: 5 },
]
const enrollments = [
  {
    id: 'e1', current_step_index: 1, status: 'active',
    opportunities: { id: 'o1', organization_name: 'Acme', context_title: 'Engineer' },
  },
]

beforeEach(() => {
  global.fetch = jest.fn()
  window.confirm = jest.fn(() => true)
})

test('renders campaign name, steps, and enrollments', () => {
  render(<CampaignDetail campaign={campaign} steps={steps} enrollments={enrollments} />)
  expect(screen.getByDisplayValue('Follow-up Sequence')).toBeInTheDocument()
  expect(screen.getByText('Initial follow-up')).toBeInTheDocument()
  expect(screen.getByText('Check in')).toBeInTheDocument()
  expect(screen.getByText(/Acme — Engineer/)).toBeInTheDocument()
})

test('shows empty state when there are no steps', () => {
  render(<CampaignDetail campaign={campaign} steps={[]} enrollments={[]} />)
  expect(screen.getByText(/no steps yet/i)).toBeInTheDocument()
  expect(screen.getByText(/no opportunities enrolled yet/i)).toBeInTheDocument()
})

test('deletes a step after confirmation', async () => {
  global.fetch.mockResolvedValue({ ok: true })
  const user = userEvent.setup()
  render(<CampaignDetail campaign={campaign} steps={steps} enrollments={enrollments} />)
  const removeButtons = screen.getAllByRole('button', { name: /remove step/i })
  await user.click(removeButtons[0])
  expect(window.confirm).toHaveBeenCalled()
  expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/c1/steps/s1', { method: 'DELETE' })
})

test('opens the new step form', async () => {
  const user = userEvent.setup()
  render(<CampaignDetail campaign={campaign} steps={steps} enrollments={enrollments} />)
  await user.click(screen.getByRole('button', { name: /add step/i }))
  expect(screen.getByPlaceholderText(/step label/i)).toBeInTheDocument()
})
