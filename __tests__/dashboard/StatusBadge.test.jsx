import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/dashboard/StatusBadge'

test.each([
  ['applied',       'Applied'],
  ['replied',       'Replied'],
  ['interview',     'Interview'],
  ['offer',         'Offer'],
  ['rejected',      'Rejected'],
  ['ghosted',       'Ghosted'],
  ['follow_up_due', 'Follow Up Due'],
  ['withdrawn',     'Withdrawn'],
])('renders correct label for status "%s"', (status, expectedLabel) => {
  render(<StatusBadge status={status} />)
  expect(screen.getByText(expectedLabel)).toBeInTheDocument()
})

test('renders unknown status as-is', () => {
  render(<StatusBadge status="unknown_xyz" />)
  expect(screen.getByText('unknown_xyz')).toBeInTheDocument()
})
