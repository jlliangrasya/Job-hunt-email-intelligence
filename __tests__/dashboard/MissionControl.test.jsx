import { render, screen } from '@testing-library/react'
import { MissionControl } from '@/components/dashboard/mission-control/MissionControl'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))

const opportunities = [
  { id: '1', organization_name: 'Acme', context_title: 'Engineer', status: 'offer', last_activity_at: null, follow_up_due_at: null },
  { id: '2', organization_name: 'Globex', context_title: 'Designer', status: 'applied', last_activity_at: null, follow_up_due_at: '2026-01-01T00:00:00Z' },
]

const replies = [
  { id: 'r1', opportunity_id: '1', subject: 'Re: application', from_address: 'hr@acme.com', received_at: '2026-01-01T00:00:00Z', opportunities: { organization_name: 'Acme' } },
]

const notifications = [
  { id: 'n1', title: 'Interview detected', body: 'Acme wants to schedule a call', created_at: '2026-01-01T00:00:00Z' },
]

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ summary: 'Two active opportunities.', recommendations: ['Follow up with Globex'] }),
  })
})

test('renders all Mission Control widgets with real data', async () => {
  render(<MissionControl opportunities={opportunities} replies={replies} notifications={notifications} />)

  expect(screen.getByText(/today's briefing/i)).toBeInTheDocument()
  expect(await screen.findByText('Two active opportunities.')).toBeInTheDocument()
  expect(screen.getByText('Follow up with Globex')).toBeInTheDocument()

  expect(screen.getByText(/opportunity funnel/i)).toBeInTheDocument()

  expect(screen.getByText(/priority opportunities/i)).toBeInTheDocument()
  expect(screen.getAllByText('Acme').length).toBeGreaterThan(0)

  expect(screen.getByText(/upcoming follow-ups/i)).toBeInTheDocument()
  expect(screen.getAllByText('Globex').length).toBeGreaterThan(0)

  expect(screen.getByText(/recent replies/i)).toBeInTheDocument()
  expect(screen.getByText('Re: application')).toBeInTheDocument()

  expect(screen.getByText(/activity feed/i)).toBeInTheDocument()
  expect(screen.getByText('Interview detected')).toBeInTheDocument()
})
