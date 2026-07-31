import { getDomainConfig, matchesInboundSignal } from '@/lib/opportunity/domain-config'
import { isNoReplyAddress, parseAddress } from '@/lib/utils/email-parser'

describe('matchesInboundSignal', () => {
  test.each([
    ['LinkedIn Easy Apply', 'jobs-noreply@linkedin.com', 'Your application was sent to Acme'],
    ['Indeed', 'noreply@indeed.com', 'Application submitted'],
    ['an ATS subdomain', 'no-reply@mail.greenhouse.io', 'Acme'],
    ['a full display-name header', '"Workday" <noreply@myworkday.com>', 'Thank you'],
    ['an employer on its own domain', 'careers@acme.com', 'We received your application'],
    ['case-insensitively', 'Jobs@LinkedIn.com', 'ANYTHING'],
  ])('accepts %s', (_label, from, subject) => {
    expect(matchesInboundSignal('job', { from, subject })).toBe(true)
  })

  test.each([
    ['an unrelated newsletter', 'newsletter@substack.com', 'This week in tech'],
    ['a lookalike domain', 'noreply@notlinkedin.com', 'Hello'],
    ['a receipt', 'receipts@stripe.com', 'Your receipt'],
    ['empty headers', '', ''],
  ])('rejects %s', (_label, from, subject) => {
    expect(matchesInboundSignal('job', { from, subject })).toBe(false)
  })

  test('tolerates missing input', () => {
    expect(matchesInboundSignal('job')).toBe(false)
    expect(matchesInboundSignal('job', {})).toBe(false)
  })
})

describe('inboundDetectionQuery', () => {
  const { inboundDetectionQuery, inboundSenderDomains, inboundSubjectPhrases } =
    getDomainConfig('job')

  test('excludes sent mail, so the query cannot re-match the user\'s own applications', () => {
    expect(inboundDetectionQuery).toContain('-in:sent')
  })

  test('is built from the same lists the runtime prefilter uses', () => {
    for (const domain of inboundSenderDomains) {
      expect(inboundDetectionQuery).toContain(domain)
    }
    for (const phrase of inboundSubjectPhrases) {
      expect(inboundDetectionQuery).toContain(`"${phrase}"`)
    }
  })
})

describe('reply-target safety', () => {
  test.each([
    'jobs-noreply@linkedin.com',
    'no-reply@indeed.com',
    'donotreply@myworkday.com',
    'notifications@ashbyhq.com',
    'mailer-daemon@acme.com',
    '',
  ])('%s is not usable as a reply target', (address) => {
    expect(isNoReplyAddress(address)).toBe(true)
  })

  test.each(['dana@acme.com', '"Dana Reyes" <dana@acme.com>', 'recruiting@acme.com'])(
    '%s is usable as a reply target',
    (address) => {
      expect(isNoReplyAddress(address)).toBe(false)
    }
  )

  test('parseAddress unwraps a display-name header and lowercases', () => {
    expect(parseAddress('"Dana Reyes" <Dana@Acme.com>')).toBe('dana@acme.com')
    expect(parseAddress('dana@acme.com')).toBe('dana@acme.com')
  })

  test('parseAddress returns empty for anything that is not a single address', () => {
    expect(parseAddress('Acme Recruiting')).toBe('')
    expect(parseAddress('a@b.com, c@d.com')).toBe('')
    expect(parseAddress(null)).toBe('')
  })
})
