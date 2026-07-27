import { describe, expect, it } from 'vitest'
import { withClearOption } from './fuzzy'

const options = [
  { id: 'req-1', label: 'First match' },
  { id: 'req-2', label: 'Second match' },
]
const clearOption = { id: '', label: 'None' }

describe('withClearOption', () => {
  it('keeps the clear option first before the user searches', () => {
    expect(withClearOption(options, clearOption, '')).toEqual([
      clearOption,
      ...options,
    ])
  })

  it('keeps search matches ahead of the clear option', () => {
    expect(withClearOption(options, clearOption, 'first')).toEqual([
      ...options,
      clearOption,
    ])
  })
})
