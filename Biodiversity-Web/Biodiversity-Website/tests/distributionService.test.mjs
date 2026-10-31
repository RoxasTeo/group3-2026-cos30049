import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distributionColor, distributionStats, hasCoordinates } from '../src/services/distributionService.js'

test('only finite numeric coordinate pairs are mapped; zero coordinates remain valid', () => {
  for (const row of [{}, { latitude: null, longitude: 1 }, { latitude: 1, longitude: null }, { latitude: '3.81', longitude: 113.78 }, { latitude: Infinity, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 1, longitude: -181 }]) assert.equal(hasCoordinates(row), false)
  assert.equal(hasCoordinates({ latitude: 0, longitude: 0 }), true)
  assert.equal(hasCoordinates({ latitude: -90, longitude: 180 }), true)
})

test('map counts describe observations and unique linked species, excluding missing GPS', () => {
  const data = [
    { species_id: 1, latitude: 3.81, longitude: 113.78 },
    { species_id: 1, latitude: 3.82, longitude: 113.79 },
    { species_id: 2, latitude: null, longitude: null },
    { species_id: 3, latitude: 3.8, longitude: 113.77 },
  ]
  assert.equal(distributionStats(data).mapped.length, 3)
  assert.equal(distributionStats(data).species, 2)
  assert.deepEqual(distributionStats([]), { mapped: [], species: 0 })
})

test('threatened assessments share a stable marker category; other status remains distinct', () => {
  assert.equal(distributionColor('Vulnerable'), distributionColor('Endangered'))
  assert.equal(distributionColor('Vulnerable'), distributionColor('Critically Endangered'))
  assert.notEqual(distributionColor('Vulnerable'), distributionColor('Least Concern'))
  assert.notEqual(distributionColor('Not Evaluated'), distributionColor('Least Concern'))
})
