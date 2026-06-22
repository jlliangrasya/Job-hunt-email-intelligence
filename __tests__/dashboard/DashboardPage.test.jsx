import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(app)/dashboard/page'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'me@test.com' } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    channel: () => ({ on: function() { return this }, subscribe: () => ({}) }),
    removeChannel: jest.fn(),
  }),
}))

test('renders Applications heading', async () => {
  render(await DashboardPage())
  expect(screen.getByRole('heading', { name: /applications/i })).toBeInTheDocument()
})
