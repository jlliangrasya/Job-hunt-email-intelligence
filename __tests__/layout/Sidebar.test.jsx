import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/layout/Sidebar'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

test('renders Dashboard and Settings nav links', () => {
  render(<Sidebar />)
  expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
  expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
})

test('marks current route link as active', () => {
  render(<Sidebar />)
  const dashLink = screen.getByRole('link', { name: /dashboard/i })
  expect(dashLink.className).toMatch(/bg-sidebar-accent/)
})
