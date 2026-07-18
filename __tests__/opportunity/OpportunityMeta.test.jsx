import { render, screen } from '@testing-library/react'
import { OpportunityMeta } from '@/components/opportunity/OpportunityMeta'

const opportunity = {
  id: '1',
  type: 'job',
  organization_name: 'Acme Corp',
  context_title: 'Senior Engineer',
  status: 'interview',
  initiated_at: '2026-06-01',
  last_activity_at: '2026-06-18',
  follow_up_due_at: null,
  recipient_email: 'hr@acme.com',
  subject: 'Application for Senior Engineer',
  ai_confidence: 0.92,
  notes: null,
}

test('renders organization name and context title', () => {
  render(<OpportunityMeta opportunity={opportunity} />)
  expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
})

test('renders status badge', () => {
  render(<OpportunityMeta opportunity={opportunity} />)
  expect(screen.getByText('Interview')).toBeInTheDocument()
})

test('renders recipient email', () => {
  render(<OpportunityMeta opportunity={opportunity} />)
  expect(screen.getByText('hr@acme.com')).toBeInTheDocument()
})

test('renders AI confidence as percentage', () => {
  render(<OpportunityMeta opportunity={opportunity} />)
  expect(screen.getByText('92%')).toBeInTheDocument()
})
