import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '@/components/dashboard/FilterBar'

test('calls onSearchChange as user types', async () => {
  const user = userEvent.setup()
  const onSearchChange = jest.fn()
  render(
    <FilterBar statusFilter="" searchQuery="" onStatusChange={jest.fn()} onSearchChange={onSearchChange} />
  )
  await user.type(screen.getByPlaceholderText(/search/i), 'Google')
  expect(onSearchChange).toHaveBeenLastCalledWith('Google')
})

test('calls onStatusChange when status option is selected', async () => {
  const user = userEvent.setup()
  const onStatusChange = jest.fn()
  render(
    <FilterBar statusFilter="" searchQuery="" onStatusChange={onStatusChange} onSearchChange={jest.fn()} />
  )
  await user.selectOptions(screen.getByRole('combobox'), 'applied')
  expect(onStatusChange).toHaveBeenCalledWith('applied')
})
