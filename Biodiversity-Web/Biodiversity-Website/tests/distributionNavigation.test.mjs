import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detailFromDistribution, distributionReturn, distributionState } from '../src/services/distributionNavigation.js'

test('detail return context round-trips map filters, pending, selection and basemap choice', () => {
  const state = { q: 'fern & tree', species: '12', conservation: 'Least Concern', pending: true, selected: 42, online: false }
  const detail = detailFromDistribution('/observations/42', state)
  assert.equal(detail.path, '/observations/42')
  const back = distributionReturn(detail.query.returnTo)
  assert.equal(back.path, '/distribution')
  assert.deepEqual(distributionState(back.query), { ...state, selected: '42' })
})

test('only map-local return destinations and allowlisted state are accepted', () => {
  for (const value of ['https://evil.example/distribution', '//evil.example/distribution', '/distribution/other', '/distribution#evil', '/species', ['bad'], null]) assert.equal(distributionReturn(value), null)
  assert.deepEqual(distributionReturn('/distribution?species=invalid&selected=0&redirect=https://evil.example'), { path: '/distribution', query: {} })
})
