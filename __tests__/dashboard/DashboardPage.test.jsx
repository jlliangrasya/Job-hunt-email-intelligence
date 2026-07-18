import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(app)/dashboard/page'

function createChainable(result = { data: [], error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    then: (resolve) => resolve(result),
  }
  return chain
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'me@test.com' } } }),
    },
    from: jest.fn(() => createChainable()),
  }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    channel: () => ({ on: function() { return this }, subscribe: () => ({}) }),
    removeChannel: jest.fn(),
  }),
}))
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ summary: '', recommendations: [] }),
})

test('renders Dashboard heading', async () => {
  render(await DashboardPage())
  expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
})
