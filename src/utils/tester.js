// Tester mode: a tester opens the site once with ?tester=<name> (e.g.
// tanakh-reading-demo.vercel.app/?tester=rafi). The name is remembered on that
// device, and each of their recordings is saved with it for review (see
// api/openai-audio.js and the Review page, /?review). ?tester=off stops it.
// Nobody else's recordings are saved.

const KEY = 'tanakh-tester'

// A tester name as stored: lowercase letters, digits, spaces, - and _
export const cleanTesterName = name =>
  String(name ?? '').toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 32)

// Take ?tester= from the address (then drop it from the address bar)
function readFromUrl() {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('tester')) return
  const name = cleanTesterName(params.get('tester'))
  if (name && name !== 'off') localStorage.setItem(KEY, name)
  else localStorage.removeItem(KEY)
  params.delete('tester')
  const query = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
}

let fromUrlRead = false

// This device's tester name, or null when it isn't a tester's (and outside a browser)
export function currentTester() {
  if (typeof window === 'undefined') return null
  try {
    if (!fromUrlRead) { fromUrlRead = true; readFromUrl() }
    return localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}
