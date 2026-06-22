import { render, screen } from '@testing-library/react'
import { StatsCards } from '@/components/dashboard/StatsCards'

const makeApps = (statusCounts) =>
  Object.entries(statusCounts).flatMap(([status, count]) =>
    Array.from({ length: count }, (_, i) => ({ id: `${status}-${i}`, status }))
  )

test('shows correct counts for each tracked status', () => {
  const applications = makeApps({ applied: 5, interview: 2, offer: 1, rejected: 3 })
  render(<StatsCards applications={applications} />)
  // These texts appear in the count cells
  expect(screen.getByText('5')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('shows zero for all when applications is empty', () => {
  render(<StatsCards applications={[]} />)
  expect(screen.getAllByText('0')).toHaveLength(4)
})
