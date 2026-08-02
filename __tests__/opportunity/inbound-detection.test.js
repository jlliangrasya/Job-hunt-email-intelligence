import { getDomainConfig, matchesInboundSignal } from '@/lib/opportunity/domain-config'
import { isNoReplyAddress, normalizeSnippet, parseAddress } from '@/lib/utils/email-parser'

describe('matchesInboundSignal', () => {
  test.each([
    ['LinkedIn Easy Apply', 'jobs-noreply@linkedin.com', 'Your application was sent to Acme'],
    ['Indeed Apply', 'indeedapply@indeed.com', 'Indeed Application: Full Stack Developer'],
    ['Jobstreet', 'noreply@e.jobstreet.com', 'Your application was successfully submitted'],
    ['an ATS subdomain', 'no-reply@mail.greenhouse.io', 'Acme'],
    ['a full display-name header', '"Workday" <noreply@myworkday.com>', 'Thank you'],
    ['an employer on its own domain', 'careers@acme.com', 'We received your application'],
    ['a phrase Gmail cannot reach by adjacency', 'x@acme.com', 'Application was successfully submitted'],
    ['case-insensitively', 'Jobs-NoReply@LinkedIn.com', 'Your Application To Acme'],
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

  // The noise that made inbound detection unaffordable: matching job boards by
  // domain admitted hundreds of alerts per mailbox for a handful of real
  // confirmations. Boards are matched by transactional address, and alert
  // subjects are rejected even on an address that does send confirmations.
  test.each([
    ['a job alert', 'jobalerts-noreply@linkedin.com', 'Full Stack Engineer at BJAK'],
    ['a profile-view notice', 'messages-noreply@linkedin.com', '36 people viewed your profile'],
    ['an Indeed alert digest', 'donotreply@jobalert.indeed.com', 'C# Programmer and 16 more new jobs'],
    ['a Glassdoor promotion', 'noreply@glassdoor.com', 'Infosys is hiring for .NET Developer'],
    ['an advert on a transactional address', 'jobs-noreply@linkedin.com', "Apply now to 'Engineer at Acme'"],
    ['a recommendation digest', 'jobs-noreply@linkedin.com', 'New jobs similar to Software Engineer'],
  ])('rejects %s', (_label, from, subject) => {
    expect(matchesInboundSignal('job', { from, subject })).toBe(false)
  })

  test('tolerates missing input', () => {
    expect(matchesInboundSignal('job')).toBe(false)
    expect(matchesInboundSignal('job', {})).toBe(false)
  })
})

describe('inboundDetectionQuery', () => {
  const {
    inboundDetectionQuery,
    inboundSenderDomains,
    inboundSenderAddresses,
    inboundSubjectPhrases,
    inboundExcludeSubjectPhrases,
  } = getDomainConfig('job')

  test('excludes sent mail, so the query cannot re-match the user\'s own applications', () => {
    expect(inboundDetectionQuery).toContain('-in:sent')
  })

  test('is built from the same lists the runtime prefilter uses', () => {
    for (const value of [...inboundSenderDomains, ...inboundSenderAddresses]) {
      expect(inboundDetectionQuery).toContain(value)
    }
    for (const phrase of inboundSubjectPhrases) {
      expect(inboundDetectionQuery).toContain(`"${phrase}"`)
    }
  })

  test('negates alert subjects, so the query and the prefilter agree on what noise is', () => {
    for (const phrase of inboundExcludeSubjectPhrases) {
      expect(inboundDetectionQuery).toContain(`"${phrase}"`)
    }
    expect(inboundDetectionQuery).toMatch(/-subject:\(/)
  })

  test('does not match job boards by bare domain', () => {
    for (const board of ['linkedin.com', 'indeed.com', 'glassdoor.com', 'jobsdb.com']) {
      expect(inboundSenderDomains).not.toContain(board)
    }
  })
})

describe('normalizeSnippet', () => {
  // Verbatim shape of a real Indeed Apply confirmation: an entity-escaped teaser
  // followed by preview padding that is most of the snippet by character count.
  test('strips the preview padding templated mail buries the signal under', () => {
    const raw = `We&#39;ll help you get started ${'‌ '.repeat(100)}`
    expect(normalizeSnippet(raw)).toBe("We'll help you get started")
  })

  test.each([
    ['&amp;', 'a&b'],
    ['&quot;', 'a"b'],
    ['&nbsp;', 'a b'],
    ['&#x27;', "a'b"],
    ['&#8217;', 'a’b'],
  ])('decodes %s', (entity, expected) => {
    expect(normalizeSnippet(`a${entity}b`)).toBe(expected)
  })

  test('leaves an unknown entity alone rather than mangling it', () => {
    expect(normalizeSnippet('50 &fakeent; off')).toBe('50 &fakeent; off')
  })

  test('tolerates missing input', () => {
    expect(normalizeSnippet(undefined)).toBe('')
    expect(normalizeSnippet(null)).toBe('')
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
