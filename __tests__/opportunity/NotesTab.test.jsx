import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotesTab } from '@/components/opportunity/NotesTab'

global.fetch = jest.fn()

beforeEach(() => jest.clearAllMocks())

test('renders existing notes', () => {
  render(<NotesTab opportunityId="opp-1" initialNotes="Referred by Dana." />)
  expect(screen.getByRole('textbox')).toHaveValue('Referred by Dana.')
})

test('renders an empty textarea when there are no notes', () => {
  render(<NotesTab opportunityId="opp-1" initialNotes={null} />)
  expect(screen.getByRole('textbox')).toHaveValue('')
})

test('PATCHes the opportunity on save', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
  render(<NotesTab opportunityId="opp-1" initialNotes="" />)

  await user.type(screen.getByRole('textbox'), 'Salary range discussed')
  await user.click(screen.getByRole('button', { name: /save notes/i }))

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/opportunities/opp-1',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Salary range discussed' }),
    })
  ))
})

test('confirms the save to the user', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
  render(<NotesTab opportunityId="opp-1" initialNotes="hi" />)
  await user.click(screen.getByRole('button', { name: /save notes/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument())
})

test('surfaces a server error instead of silently failing', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({
    ok: false,
    json: () => Promise.resolve({ error: 'row-level security violation' }),
  })
  render(<NotesTab opportunityId="opp-1" initialNotes="hi" />)
  await user.click(screen.getByRole('button', { name: /save notes/i }))
  await waitFor(() =>
    expect(screen.getByText('row-level security violation')).toBeInTheDocument()
  )
})

test('surfaces a network failure', async () => {
  const user = userEvent.setup()
  global.fetch.mockRejectedValueOnce(new Error('offline'))
  render(<NotesTab opportunityId="opp-1" initialNotes="hi" />)
  await user.click(screen.getByRole('button', { name: /save notes/i }))
  await waitFor(() => expect(screen.getByText(/could not save notes/i)).toBeInTheDocument())
})
