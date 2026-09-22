import { describe,expect,it } from 'vitest'
import { presetRange } from './dateRange'

describe('presetRange',()=>{
 it('returns a valid 7-day range',()=>{
  const r=presetRange('7d')
  expect(r.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(r.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(r.from<=r.to).toBe(true)
 })
})
