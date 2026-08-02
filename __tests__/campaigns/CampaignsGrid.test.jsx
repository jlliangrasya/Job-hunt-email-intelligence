import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignsGrid } from '@/components/campaigns/CampaignsGrid'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const campaigns = [
  { id: '1', name: 'Follow-up Sequence', description: 'Standard 3-touch follow-up' },
  { id: '2', name: 'Interview Prep', description: 'Steps for post-interview outreach' },
]

test('renders all campaigns', () => {
  render(<CampaignsGrid initialCampaigns={campaigns} />)
  expect(screen.getByText('Follow-up Sequence')).toBeInTheDocument()
  expect(screen.getByText('Interview Prep')).toBeInTheDocument()
})

test('navigates to detail page on card click', async () => {
  const user = userEvent.setup()
  render(<CampaignsGrid initialCampaigns={campaigns} />)
  await user.click(screen.getByText('Follow-up Sequence'))
  expect(mockPush).toHaveBeenCalledWith('/campaigns/1')
})

test('filters campaigns by search query', async () => {
  const user = userEvent.setup()
  render(<CampaignsGrid initialCampaigns={campaigns} />)
  await user.type(screen.getByPlaceholderText(/search campaigns/i), 'Interview')
  expect(screen.queryByText('Follow-up Sequence')).not.toBeInTheDocument()
  expect(screen.getByText('Interview Prep')).toBeInTheDocument()
})

test('shows empty state when no campaigns', () => {
  render(<CampaignsGrid initialCampaigns={[]} />)
  expect(screen.getByText(/no campaigns found/i)).toBeInTheDocument()
})
