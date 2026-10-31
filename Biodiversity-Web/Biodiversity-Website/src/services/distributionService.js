import { request } from './authService.js'

export function hasCoordinates(record) {
  return typeof record?.latitude === 'number' && Number.isFinite(record.latitude) && Math.abs(record.latitude) <= 90 &&
    typeof record?.longitude === 'number' && Number.isFinite(record.longitude) && Math.abs(record.longitude) <= 180
}

export function distributionColor(status) {
  if (['Vulnerable', 'Endangered', 'Critically Endangered'].includes(status)) return '#a77a32'
  if (status === 'Least Concern') return '#3c7355'
  return '#758275'
}

export function distributionStats(records) {
  const mapped = records.filter(hasCoordinates)
  return { mapped, species: new Set(mapped.map(record => record.species_id)).size }
}

export function loadDistribution(filters, signal) {
  const params = new URLSearchParams({ q: filters.q, include_pending: filters.pending ? '1' : '0' })
  if (filters.species) params.set('species_id', filters.species)
  if (filters.conservation) params.set('conservation_status', filters.conservation)
  return request(`/api/get_species_distribution.php?${params}`, { signal })
}
