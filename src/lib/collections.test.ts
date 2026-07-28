import { describe, expect, it } from 'vitest'
import { groupBy, indexById } from './collections'

describe('collection indexes', () => {
  it('indexes records by id', () => {
    const records = [
      { id: 'one', value: 1 },
      { id: 'two', value: 2 },
    ]

    expect(indexById(records).get('two')).toEqual(records[1])
  })

  it('groups records while preserving their input order', () => {
    const records = [
      { id: 'one', category: 'a' },
      { id: 'two', category: 'b' },
      { id: 'three', category: 'a' },
    ]

    expect(groupBy(records, (record) => record.category).get('a')).toEqual([
      records[0],
      records[2],
    ])
  })
})
