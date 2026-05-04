import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSetDoc, mockGetDoc, mockDoc, mockIncrement } = vi.hoisted(() => ({
  mockSetDoc: vi.fn(() => Promise.resolve()),
  mockGetDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockIncrement: vi.fn((n) => ({ __increment: n })),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  increment: mockIncrement,
}))

vi.mock('../src/firebase.js', () => ({
  db: {},
}))

let submitGameResults, fetchSolveRates

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../src/leaderboard.js')
  submitGameResults = mod.submitGameResults
  fetchSolveRates = mod.fetchSolveRates
})

describe('submitGameResults', () => {
  const makeRounds = (solvedIndices, answerByIndex = {}) =>
    Array.from({ length: 10 }, (_, i) => ({
      answer: solvedIndices.includes(i) ? (answerByIndex[i] || 'word') : '',
      timeMs: 5000,
      root: 'test',
      offeredLetters: ['a', 'b', 'c'],
      possibleAnswers: ['word'],
      hinted: false,
    }))

  it('submits increment for totalGames and each solved round', async () => {
    const rounds = makeRounds([0, 2, 5])
    await submitGameResults('2026-04-15', rounds)

    expect(mockSetDoc).toHaveBeenCalledOnce()
    const [, data, options] = mockSetDoc.mock.calls[0]
    expect(options).toEqual({ merge: true })
    expect(data.totalGames).toEqual({ __increment: 1 })
    expect(data.round0Solved).toEqual({ __increment: 1 })
    expect(data.round2Solved).toEqual({ __increment: 1 })
    expect(data.round5Solved).toEqual({ __increment: 1 })
  })

  it('does not include increment for skipped rounds', async () => {
    const rounds = makeRounds([0, 2, 5])
    await submitGameResults('2026-04-15', rounds)

    const [, data] = mockSetDoc.mock.calls[0]
    expect(data).not.toHaveProperty('round1Solved')
    expect(data).not.toHaveProperty('round3Solved')
    expect(data).not.toHaveProperty('round4Solved')
    expect(data).not.toHaveProperty('round6Solved')
    expect(data).not.toHaveProperty('round7Solved')
    expect(data).not.toHaveProperty('round8Solved')
    expect(data).not.toHaveProperty('round9Solved')
  })

  it('submits all 10 round increments when all rounds solved', async () => {
    const rounds = makeRounds([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    await submitGameResults('2026-04-15', rounds)

    const [, data] = mockSetDoc.mock.calls[0]
    for (let i = 0; i < 10; i++) {
      expect(data[`round${i}Solved`]).toEqual({ __increment: 1 })
    }
  })

  it('submits only totalGames when no rounds solved', async () => {
    const rounds = makeRounds([])
    await submitGameResults('2026-04-15', rounds)

    const [, data] = mockSetDoc.mock.calls[0]
    expect(data.totalGames).toEqual({ __increment: 1 })
    for (let i = 0; i < 10; i++) {
      expect(data).not.toHaveProperty(`round${i}Solved`)
    }
  })

  it('uses the dateStr as the document path', async () => {
    const rounds = makeRounds([0])
    await submitGameResults('2026-04-15', rounds)

    expect(mockDoc).toHaveBeenCalledWith({}, 'daily', '2026-04-15')
  })

  it('records the submitted answer under round{N}Answers for each solved round', async () => {
    const rounds = makeRounds([0, 2, 5], { 0: 'chin', 2: 'baste', 5: 'diner' })
    await submitGameResults('2026-04-15', rounds)

    const [, data] = mockSetDoc.mock.calls[0]
    expect(data.round0Answers).toEqual({ chin: { __increment: 1 } })
    expect(data.round2Answers).toEqual({ baste: { __increment: 1 } })
    expect(data.round5Answers).toEqual({ diner: { __increment: 1 } })
  })

  it('does not record answers for skipped rounds', async () => {
    const rounds = makeRounds([0, 2, 5])
    await submitGameResults('2026-04-15', rounds)

    const [, data] = mockSetDoc.mock.calls[0]
    for (const i of [1, 3, 4, 6, 7, 8, 9]) {
      expect(data).not.toHaveProperty(`round${i}Answers`)
    }
  })
})

describe('fetchSolveRates', () => {
  it('returns percentages computed from firestore data', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        totalGames: 50,
        round0Solved: 40,
        round1Solved: 25,
        round2Solved: 50,
        round3Solved: 0,
        round4Solved: 10,
        round5Solved: 35,
        round6Solved: 45,
        round7Solved: 20,
        round8Solved: 15,
        round9Solved: 5,
      }),
    })

    const result = await fetchSolveRates('2026-04-15')
    expect(result.rates).toEqual([80, 50, 100, 0, 20, 70, 90, 40, 30, 10])
  })

  it('returns null when document does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    })

    const result = await fetchSolveRates('2026-04-15')
    expect(result).toBeNull()
  })

  it('treats missing round fields as 0', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        totalGames: 10,
        round0Solved: 8,
        // rounds 1-9 not present
      }),
    })

    const result = await fetchSolveRates('2026-04-15')
    expect(result.rates[0]).toBe(80)
    for (let i = 1; i < 10; i++) {
      expect(result.rates[i]).toBe(0)
    }
  })

  it('returns null when fewer than 10 games played', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        totalGames: 9,
        round0Solved: 7,
      }),
    })

    const result = await fetchSolveRates('2026-04-15')
    expect(result).toBeNull()
  })

  it('returns per-round answer counts alongside rates', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        totalGames: 50,
        round0Solved: 40,
        round0Answers: { chin: 30, inch: 8, rich: 2 },
        round1Solved: 25,
        round1Answers: { baste: 20, beats: 5 },
      }),
    })

    const result = await fetchSolveRates('2026-04-15')
    expect(result.answerCounts[0]).toEqual({ chin: 30, inch: 8, rich: 2 })
    expect(result.answerCounts[1]).toEqual({ baste: 20, beats: 5 })
  })

  it('treats missing round{N}Answers as empty maps', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        totalGames: 50,
        round0Solved: 40,
        round0Answers: { chin: 30 },
        // round1Answers absent
      }),
    })

    const result = await fetchSolveRates('2026-04-15')
    expect(result.answerCounts[0]).toEqual({ chin: 30 })
    expect(result.answerCounts[1]).toEqual({})
  })
})
