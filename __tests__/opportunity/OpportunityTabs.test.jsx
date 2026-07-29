import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpportunityTabs } from '@/components/opportunity/OpportunityTabs'

const tabs = [
  { id: 'overview', label: 'Overview', content: <p>overview panel</p> },
  { id: 'timeline', label: 'Timeline', count: 3, content: <p>timeline panel</p> },
  { id: 'notes', label: 'Notes', content: <p>notes panel</p> },
]

test('renders one tab per entry', () => {
  render(<OpportunityTabs tabs={tabs} />)
  expect(screen.getAllByRole('tab')).toHaveLength(3)
})

test('selects the first tab by default', () => {
  render(<OpportunityTabs tabs={tabs} />)
  expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('overview panel')
})

test('honors defaultTab from the url', () => {
  render(<OpportunityTabs tabs={tabs} defaultTab="notes" />)
  expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('notes panel')
})

test('falls back to the first tab when defaultTab is unknown', () => {
  render(<OpportunityTabs tabs={tabs} defaultTab="campaigns" />)
  expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
})

test('clicking a tab shows its panel and hides the others', async () => {
  const user = userEvent.setup()
  render(<OpportunityTabs tabs={tabs} />)
  await user.click(screen.getByRole('tab', { name: /timeline/i }))
  const panel = screen.getByRole('tabpanel')
  expect(panel).toHaveTextContent('timeline panel')
  expect(panel).not.toHaveTextContent('overview panel')
})

test('renders a count badge when a tab provides one', () => {
  render(<OpportunityTabs tabs={tabs} />)
  expect(screen.getByRole('tab', { name: /timeline/i })).toHaveTextContent('3')
})

test('arrow keys move between tabs', async () => {
  const user = userEvent.setup()
  render(<OpportunityTabs tabs={tabs} />)
  await user.click(screen.getByRole('tab', { name: /overview/i }))
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: /timeline/i })).toHaveAttribute('aria-selected', 'true')
  await user.keyboard('{ArrowLeft}')
  expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
})

test('End and Home jump to the last and first tabs', async () => {
  const user = userEvent.setup()
  render(<OpportunityTabs tabs={tabs} />)
  await user.click(screen.getByRole('tab', { name: /overview/i }))
  await user.keyboard('{End}')
  expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')
  await user.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true')
})

test('only the active tab is in the tab order', async () => {
  const user = userEvent.setup()
  render(<OpportunityTabs tabs={tabs} />)
  await user.click(screen.getByRole('tab', { name: /timeline/i }))
  expect(screen.getByRole('tab', { name: /timeline/i })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('tabindex', '-1')
})

test('mirrors the active tab into the ?tab= query param', async () => {
  const user = userEvent.setup()
  const replaceState = jest.spyOn(window.history, 'replaceState')
  render(<OpportunityTabs tabs={tabs} />)
  await user.click(screen.getByRole('tab', { name: /timeline/i }))
  expect(replaceState).toHaveBeenCalledWith(null, '', expect.objectContaining({
    search: '?tab=timeline',
  }))
  replaceState.mockRestore()
})

test('inactive panels stay mounted so in-progress edits survive a tab switch', async () => {
  const user = userEvent.setup()
  render(<OpportunityTabs tabs={tabs} />)
  await user.click(screen.getByRole('tab', { name: /timeline/i }))
  // Hidden, not unmounted: still in the DOM but out of the accessibility tree.
  expect(screen.getByText('overview panel')).toBeInTheDocument()
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
})
