import { render, screen } from '@testing-library/react'
import { ApplicationMeta } from '@/components/application/ApplicationMeta'

const application = {
  id: '1',
  company_name: 'Acme Corp',
  role_title: 'Senior Engineer',
  status: 'interview',
  application_date: '2026-06-01',
  last_activity_at: '2026-06-18',
  follow_up_due_at: null,
  recipient_email: 'hr@acme.com',
  subject: 'Application for Senior Engineer',
  ai_confidence: 0.92,
  notes: null,
}

test('renders company name and role title', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
})

test('renders status badge', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('Interview')).toBeInTheDocument()
})

test('renders recipient email', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('hr@acme.com')).toBeInTheDocument()
})

test('renders AI confidence as percentage', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('92%')).toBeInTheDocument()
})
