import {
  dedupKey,
  findMatch,
  normalizeOrganization,
  normalizeTitleTokens,
  titleSimilarity,
} from '@/lib/opportunity/identity'

describe('normalizeOrganization', () => {
  test.each([
    ['Acme, Inc.', 'acme'],
    ['ACME Corporation', 'acme'],
    ['  Acme   Ltd  ', 'acme'],
    ['Acme Technologies GmbH', 'acme technologies'],
    ['Café Solutions', 'cafe solutions'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeOrganization(input)).toBe(expected)
  })

  test.each(['Unknown', 'unknown', '', null, undefined, 'N/A', 'none'])(
    'treats %s as no identity',
    (input) => {
      expect(normalizeOrganization(input)).toBe('')
    }
  )

  test('keeps descriptive suffixes that distinguish employers', () => {
    expect(normalizeOrganization('Acme Labs')).not.toBe(normalizeOrganization('Acme Studio'))
  })

  test('does not strip a legal suffix that is the whole name', () => {
    expect(normalizeOrganization('Ltd')).toBe('ltd')
  })
})

describe('normalizeTitleTokens', () => {
  test('is order-insensitive', () => {
    expect(normalizeTitleTokens('Software Engineer')).toEqual(
      normalizeTitleTokens('Engineer, Software')
    )
  })

  test('expands seniority abbreviations', () => {
    expect(normalizeTitleTokens('Sr. Software Engineer')).toEqual(
      normalizeTitleTokens('Senior Software Engineer')
    )
  })

  test('drops posting boilerplate and req numbers', () => {
    expect(normalizeTitleTokens('Software Engineer (Remote) - Job 12345')).toEqual(
      normalizeTitleTokens('Software Engineer')
    )
  })

  test('returns empty for a missing title', () => {
    expect(normalizeTitleTokens(null)).toEqual([])
  })
})

describe('dedupKey', () => {
  test('matches across punctuation, case, and abbreviation', () => {
    expect(dedupKey({ organizationName: 'Acme, Inc.', contextTitle: 'Sr. Software Engineer' })).toBe(
      dedupKey({ organizationName: 'ACME', contextTitle: 'Senior Software Engineer' })
    )
  })

  test('separates different roles at the same organization', () => {
    expect(dedupKey({ organizationName: 'Acme', contextTitle: 'Designer' })).not.toBe(
      dedupKey({ organizationName: 'Acme', contextTitle: 'Engineer' })
    )
  })

  test('is null without an organization, so unidentifiable rows never collapse together', () => {
    expect(dedupKey({ organizationName: 'Unknown', contextTitle: 'Engineer' })).toBeNull()
    expect(dedupKey({})).toBeNull()
  })
})

describe('titleSimilarity', () => {
  test('is 1 for identical token sets and 0 when one side is empty', () => {
    expect(titleSimilarity(['a', 'b'], ['a', 'b'])).toBe(1)
    expect(titleSimilarity([], ['a'])).toBe(0)
  })

  test('scores partial overlap between 0 and 1', () => {
    const score = titleSimilarity(['software', 'engineer'], ['software', 'engineer', 'backend'])
    expect(score).toBeGreaterThan(0.5)
    expect(score).toBeLessThan(1)
  })
})

describe('findMatch', () => {
  const acmeEngineer = {
    id: 'opp-1',
    organization_name: 'Acme, Inc.',
    context_title: 'Senior Software Engineer',
  }
  const acmeDesigner = {
    id: 'opp-2',
    organization_name: 'Acme',
    context_title: 'Product Designer',
  }

  test('links a near-miss title at the same organization', () => {
    const match = findMatch([acmeEngineer, acmeDesigner], {
      organizationName: 'ACME Corp',
      contextTitle: 'Sr. Software Engineer',
    })
    expect(match).toBe(acmeEngineer)
  })

  test('does not link a different role at the same organization', () => {
    const match = findMatch([acmeEngineer], {
      organizationName: 'Acme',
      contextTitle: 'Account Executive',
    })
    expect(match).toBeNull()
  })

  test('does not link a similarly-named but different employer', () => {
    const match = findMatch([acmeEngineer], {
      organizationName: 'Acme Health',
      contextTitle: 'Senior Software Engineer',
    })
    expect(match).toBeNull()
  })

  test('a title-less confirmation links when the organization has one candidate', () => {
    const match = findMatch([acmeEngineer], { organizationName: 'Acme' })
    expect(match).toBe(acmeEngineer)
  })

  test('a title-less confirmation is ambiguous with two candidates, so it links to neither', () => {
    const match = findMatch([acmeEngineer, acmeDesigner], { organizationName: 'Acme' })
    expect(match).toBeNull()
  })

  test('an untitled existing row absorbs a titled detection only when unambiguous', () => {
    const untitled = { id: 'opp-3', organization_name: 'Acme', context_title: null }
    expect(findMatch([untitled], { organizationName: 'Acme', contextTitle: 'Engineer' })).toBe(
      untitled
    )
    expect(
      findMatch([untitled, acmeDesigner], { organizationName: 'Acme', contextTitle: 'Engineer' })
    ).toBeNull()
  })

  test('returns null without an organization to anchor on', () => {
    expect(findMatch([acmeEngineer], { organizationName: 'Unknown', contextTitle: 'Engineer' }))
      .toBeNull()
  })

  test('handles an empty candidate list', () => {
    expect(findMatch([], { organizationName: 'Acme', contextTitle: 'Engineer' })).toBeNull()
    expect(findMatch(undefined, { organizationName: 'Acme' })).toBeNull()
  })
})
