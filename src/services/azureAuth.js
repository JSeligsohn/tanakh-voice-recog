// Azure Speech config backed by a short-lived token from our server
// (api/azure-token.js), so the subscription key never reaches the browser.
// Tokens last 10 minutes; we reuse one for 9.

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'

const TOKEN_REUSE_MS = 9 * 60 * 1000
let cached = null // { token, region, expiresAt }

export async function getSpeechConfig() {
  if (!cached || Date.now() > cached.expiresAt) {
    const response = await fetch('/api/azure-token')
    let data = null
    try { data = await response.json() } catch { /* non-JSON error page */ }
    if (!response.ok || !data?.token) throw new Error(data?.error ?? `Couldn't get an Azure speech token (${response.status}).`)
    cached = { token: data.token, region: data.region, expiresAt: Date.now() + TOKEN_REUSE_MS }
  }
  return SpeechSDK.SpeechConfig.fromAuthorizationToken(cached.token, cached.region)
}

// Whether Azure speech is set up on the server (keys present and valid).
// Checked once per page load; features that need it, like Listen, are hidden
// when it isn't, and come back automatically once the keys are configured.
let availability = null
export function isSpeechAvailable() {
  availability ??= getSpeechConfig().then(() => true, () => false)
  return availability
}
