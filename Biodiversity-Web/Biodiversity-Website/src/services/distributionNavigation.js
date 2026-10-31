// Keep only presentation state; never accept arbitrary redirect destinations.
let previousState = null
const text = value => typeof value === 'string' ? value : ''
const positiveId = value => /^[1-9]\d{0,9}$/.test(text(value)) ? text(value) : ''

export function distributionState(query = {}) {
  return {
    q: text(query.q).slice(0, 50), species: positiveId(query.species),
    conservation: text(query.conservation).slice(0, 40), pending: query.pending === '1',
    selected: positiveId(query.selected), online: query.online !== '0',
  }
}

export function distributionLocation(state) {
  const query = {}
  if (state.q) query.q = state.q
  if (state.species) query.species = String(state.species)
  if (state.conservation) query.conservation = state.conservation
  if (state.pending) query.pending = '1'
  if (state.selected) query.selected = String(state.selected)
  if (state.online === false) query.online = '0'
  return { path: '/distribution', query }
}

export function distributionReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/distribution') || value.length > 1000) return null
  try {
    const url = new URL(value, 'https://local.invalid')
    if (url.origin !== 'https://local.invalid' || url.pathname !== '/distribution' || url.hash) return null
    return distributionLocation(distributionState(Object.fromEntries(url.searchParams)))
  } catch { return null }
}

export function detailFromDistribution(path, state) {
  const target = distributionLocation(state)
  const params = new URLSearchParams(target.query).toString()
  return { path, query: { returnTo: target.path + (params ? '?' + params : '') } }
}

export function rememberDistribution(state) { previousState = { ...state } }
export function initialDistribution(query) {
  return Object.keys(query).length ? distributionState(query) : previousState || distributionState()
}
