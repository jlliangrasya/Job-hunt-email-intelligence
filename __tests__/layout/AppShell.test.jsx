import { render, screen } from '@testing-library/react'
import { AppShell } from '@/components/layout/AppShell'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('@/components/providers/RealtimeProvider', () => ({
  RealtimeProvider: ({ children }) => <>{children}</>,
}))
jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ notifications: [] }),
})

const mockUser = { id: 'user-1', email: 'test@example.com' }

test('renders sidebar, topnav and children', () => {
  render(
    <AppShell userId="user-1" user={mockUser}>
      <div>Page content</div>
    </AppShell>
  )
  expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  expect(screen.getByText('Page content')).toBeInTheDocument()
  expect(screen.getByText('test@example.com')).toBeInTheDocument()
})
