import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decisionError, photoSource, reviewDate } from '../src/services/observationService.js'

test('approval requires all evidence checks; non-approval decisions require meaningful notes', () => {
  const all = { notes: true, photos: true, gps: true }
  assert.match(decisionError('Approved', '', { ...all, gps: false }), /three evidence checks/)
  assert.equal(decisionError('Approved', '', all), '')
  for (const status of ['Changes requested', 'Rejected']) {
    assert.match(decisionError(status, '  ', {}), /reason/)
    assert.equal(decisionError(status, 'Please capture clearer evidence.', {}), '')
  }
  assert.match(decisionError('Synced', 'Valid notes', all), /valid review decision/)
  assert.match(decisionError('Approved', 'x'.repeat(1001), all), /1000/)
})

test('submitted images only use allowlisted inline raster data, never active SVG or external URLs', () => {
  for (const uri of ['javascript:alert(1)', 'https://example.com/track.png', 'data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA']) assert.equal(photoSource({ data_url: uri }), '')
  assert.equal(photoSource({ data_url: 'data:image/png;base64,aGVsbG8=' }), 'data:image/png;base64,aGVsbG8=')
  assert.equal(photoSource(null), '')
})

test('database timestamps are interpreted as UTC and displayed with an explicit Malaysia timezone', () => {
  assert.equal(reviewDate('2026-10-31 01:00:00'), reviewDate('2026-10-31T01:00:00Z'))
  assert.match(reviewDate('2026-10-31 01:00:00'), /09:00 MYT/)
  assert.equal(reviewDate(null), 'Not recorded')
  assert.equal(reviewDate('invalid'), 'Not recorded')
})
