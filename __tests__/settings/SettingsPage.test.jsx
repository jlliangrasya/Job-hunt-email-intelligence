import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/(app)/settings/page'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'me@test.com' } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { follow_up_delay_days: 7, email_digest_enabled: false, scan_lookback_days: 90 },
          }),
        }),
      }),
    }),
  }),
}))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    from: () => ({ update: () => ({ eq: jest.fn().mockResolvedValue({ error: null }) }) }),
  }),
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
global.fetch = jest.fn().mockResolvedValue({ ok: true })

test('renders Settings heading', async () => {
  render(await SettingsPage())
  expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
})

test('renders follow-up delay input with default value', async () => {
  render(await SettingsPage())
  expect(screen.getByLabelText(/follow.up delay/i)).toHaveValue(7)
})

test('renders Disconnect Gmail button', async () => {
  render(await SettingsPage())
  expect(screen.getByRole('button', { name: /disconnect gmail/i })).toBeInTheDocument()
})
