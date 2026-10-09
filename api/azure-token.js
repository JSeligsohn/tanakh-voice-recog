// Issues a short-lived Azure Speech access token (valid 10 minutes) so the
// browser can use Azure text-to-speech and pronunciation assessment without
// ever holding the subscription key (AZURE_SPEECH_KEY stays on the server).
//
// GET → { token, region }

export default {
  async fetch(request) {
    if (request.method !== 'GET') return Response.json({ error: 'Use GET.' }, { status: 405 })
    const key = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION
    if (!key || !region) {
      return Response.json({ error: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not set on the server.' }, { status: 500 })
    }

    const upstream = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    })
    if (!upstream.ok) {
      return Response.json({ error: `Azure token request failed (${upstream.status}).` }, { status: 502 })
    }
    return Response.json({ token: await upstream.text(), region }, { headers: { 'Cache-Control': 'no-store' } })
  },
}
