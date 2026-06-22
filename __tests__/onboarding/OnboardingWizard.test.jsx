import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

jest.mock('@/components/onboarding/StepScanProgress', () => ({
  StepScanProgress: ({ onNext }) => (
    <div>
      <p>Scan step</p>
      <button onClick={() => onNext(5)}>Complete scan</button>
    </div>
  ),
}))

test('starts on step 1 (connect gmail) when hasGmail is false', () => {
  render(<OnboardingWizard hasGmail={false} />)
  // The "Already connected — continue" button only appears on step 0
  expect(screen.getByRole('button', { name: /already connected/i })).toBeInTheDocument()
})

test('starts on step 2 (scan) when hasGmail is true', () => {
  render(<OnboardingWizard hasGmail={true} />)
  expect(screen.getByText(/scan step/i)).toBeInTheDocument()
})

test('advances from step 1 to step 2 on "Already connected" click', async () => {
  const user = userEvent.setup()
  render(<OnboardingWizard hasGmail={false} />)
  await user.click(screen.getByRole('button', { name: /already connected/i }))
  expect(screen.getByText(/scan step/i)).toBeInTheDocument()
})

test('advances from step 2 to step 3 when scan completes', async () => {
  const user = userEvent.setup()
  render(<OnboardingWizard hasGmail={true} />)
  await user.click(screen.getByRole('button', { name: /complete scan/i }))
  expect(screen.getByRole('heading', { name: /you're all set/i })).toBeInTheDocument()
  expect(screen.getByText('5')).toBeInTheDocument()
})
