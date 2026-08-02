import { classifySignalBatch } from '@/lib/groq/classify-signal'
import { createChatCompletion, GROQ_MODELS } from '@/lib/groq/client'
import { getDomainConfig } from '@/lib/opportunity/domain-config'

jest.mock('@/lib/groq/client', () => ({
  createChatCompletion: jest.fn(),
  GROQ_MODELS: { fast: 'fast-model', quality: 'quality-model' },
}))

const reply = (content) =>
  createChatCompletion.mockResolvedValue({ choices: [{ message: { content } }] })

const lastCall = () => createChatCompletion.mock.calls.at(-1)[0]

const EMAILS = [
  { subject: 'Your application was sent to Acme', from: 'jobs-noreply@linkedin.com', to: '', date: 'x', snippet: 's' },
]

beforeEach(() => {
  jest.clearAllMocks()
  reply('[{"isOpportunity":true,"confidence":0.9,"organizationName":"Acme"}]')
})

describe('model selection', () => {
  // Inbound has to separate a real confirmation from the marketing a board wraps
  // it in, frequently on the subject line alone; sent mail is self-declaring.
  test('inbound classification uses the stronger model', async () => {
    await classifySignalBatch(EMAILS, 'job', 'inbound')
    expect(lastCall().model).toBe(GROQ_MODELS.quality)
  })

  test('sent classification stays on the cheap model', async () => {
    await classifySignalBatch(EMAILS, 'job', 'sent')
    expect(lastCall().model).toBe(GROQ_MODELS.fast)
  })
})

describe('prompt construction', () => {
  test('each direction is given its own system prompt', async () => {
    const { classifyInboundPrompt, classifySignalPrompt } = getDomainConfig('job')

    await classifySignalBatch(EMAILS, 'job', 'inbound')
    expect(lastCall().messages[0].content).toBe(classifyInboundPrompt)

    await classifySignalBatch(EMAILS, 'job', 'sent')
    expect(lastCall().messages[0].content).toBe(classifySignalPrompt)
  })

  test('the counterparty header flips with the direction', async () => {
    await classifySignalBatch(EMAILS, 'job', 'inbound')
    expect(lastCall().messages[1].content).toContain('From: jobs-noreply@linkedin.com')

    await classifySignalBatch([{ ...EMAILS[0], to: 'hr@acme.com' }], 'job', 'sent')
    expect(lastCall().messages[1].content).toContain('To: hr@acme.com')
  })

  // Batching five emails into one call once made the model attribute a role read
  // off one email to a different one in the same batch.
  test('the batch is told to judge each email independently', async () => {
    await classifySignalBatch(EMAILS, 'job', 'inbound')
    expect(lastCall().messages[1].content).toMatch(/never carry an organization or role across/)
  })

  test('an unknown direction for a type without that prompt throws', async () => {
    await expect(classifySignalBatch(EMAILS, 'job', 'sideways')).resolves.toBeDefined()
    await expect(classifySignalBatch(EMAILS, 'nonsense', 'sent')).rejects.toThrow(
      /Unknown opportunity type/
    )
  })
})

describe('response parsing', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => console.error.mockRestore())

  test('extracts the array from a model that wraps it in prose', async () => {
    reply('Sure!\n```json\n[{"isOpportunity":true,"confidence":0.9}]\n```')

    await expect(classifySignalBatch(EMAILS, 'job', 'inbound')).resolves.toEqual([
      { isOpportunity: true, confidence: 0.9 },
    ])
  })

  // Callers index results positionally, so anything unusable must degrade to one
  // negative verdict per email. Returning a short array instead would silently
  // drop the emails it fell short of rather than merely failing to classify them.
  test.each([
    ['a response truncated before the closing bracket', '[{"isOpportunity":true, "confid'],
    ['a response containing no array at all', 'I cannot classify these emails.'],
    ['an array shorter than the batch', '[{"isOpportunity":true,"confidence":0.9}]'],
    ['an empty response', ''],
  ])('%s yields one negative result per input email', async (_label, content) => {
    reply(content)

    const results = await classifySignalBatch([EMAILS[0], EMAILS[0]], 'job', 'inbound')

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.isOpportunity === false)).toBe(true)
  })

  test('a well-formed batch response is returned as-is', async () => {
    reply('[{"isOpportunity":true,"confidence":0.9},{"isOpportunity":false,"confidence":0.1}]')

    await expect(classifySignalBatch([EMAILS[0], EMAILS[0]], 'job', 'inbound')).resolves.toEqual([
      { isOpportunity: true, confidence: 0.9 },
      { isOpportunity: false, confidence: 0.1 },
    ])
  })
})
