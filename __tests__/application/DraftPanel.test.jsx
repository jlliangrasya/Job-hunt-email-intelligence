import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftPanel } from '@/components/application/DraftPanel'

global.fetch = jest.fn()

const draft = {
  id: 'd1', draft_type: 'follow_up', subject: 'Following up',
  body_markdown: 'Hi, just checking in...', body_edited: null, was_sent: false,
}

beforeEach(() => jest.clearAllMocks())

test('shows draft type select and Generate button', () => {
  render(<DraftPanel applicationId="app-1" initialDrafts={[]} />)
  expect(screen.getByRole('combobox')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
})

test('calls POST /api/drafts on Generate click', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ draft }) })
  render(<DraftPanel applicationId="app-1" initialDrafts={[]} />)
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/drafts',
    expect.objectContaining({ method: 'POST' })
  ))
})

test('displays subject after draft is generated', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ draft }) })
  render(<DraftPanel applicationId="app-1" initialDrafts={[]} />)
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await waitFor(() => expect(screen.getByText('Following up')).toBeInTheDocument())
})

test('renders existing drafts on mount', () => {
  render(<DraftPanel applicationId="app-1" initialDrafts={[draft]} />)
  expect(screen.getByText('Following up')).toBeInTheDocument()
})
