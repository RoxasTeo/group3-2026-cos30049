import { request } from './authService.js'

export const reviewStatuses = ['Pending', 'Changes requested', 'Approved', 'Rejected', 'All']
export const evidenceChecks = ['notes', 'photos', 'gps']
export function decisionError(decision, notes, checks) {
  if (!reviewStatuses.slice(1, 4).includes(decision)) return 'Choose a valid review decision.'
  if (decision === 'Approved' && !evidenceChecks.every(key => checks[key] === true)) return 'Complete the three evidence checks before approving.'
  if (decision !== 'Approved' && !notes.trim()) return 'Explain the reason in reviewer notes before continuing.'
  if ([...notes.trim()].length > 1000) return 'Reviewer notes must be at most 1000 characters.'
  return ''
}
export function reviewDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }) + ' MYT'
}
export function photoSource(photo) {
  // Only validated inline image attachments; never navigate to submitted URLs.
  return typeof photo?.data_url === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.data_url) ? photo.data_url : ''
}
export function listObservations(filters, signal) {
  const params = new URLSearchParams({ status: filters.status, q: filters.q, page: String(filters.page) })
  if (filters.submitter) params.set('submitter', filters.submitter)
  return request(`/api/get_observations.php?${params}`, { signal })
}
export async function getObservation(id) {
  return (await request(`/api/get_observation.php?id=${encodeURIComponent(id)}`)).observation
}
export async function reviewObservation(record, decision, notes, checks) {
  const error = decisionError(decision, notes, checks)
  if (error) throw new Error(error)
  return (await request('/api/review_observation.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: record.id, version: record.version, decision, notes: notes.trim(), checks: { ...checks } }),
  })).observation
}
