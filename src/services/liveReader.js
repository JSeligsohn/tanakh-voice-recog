// The live reader's client: opens the microphone and streams it to
// api/live.js over a WebSocket while the student reads; each word comes back
// graded as soon as they're done with it (src/server/liveSocket.js has the
// messages). The final report is graded here, as phonemeAssessment.js does.

import { MIC_CONSTRAINTS } from '../utils/micReady'
import { currentTester } from '../utils/tester'
import { gradeFindings } from './phonemeAssessment'

// onEvent gets each message from the server ({ type: 'ready' | 'word' |
// 'current' | 'final' | 'error', ... }; 'final' has `report`, the graded
// results, and `audio`, the reading as a WAV blob, for playback) and
// { type: 'closed' } when the connection ends; onLevel gets the
// microphone's loudness (RMS, 0–1) about every 100 ms. Returns
// { stop, cancel, goTo, mute }.
export async function startLiveReading({ referenceText, settings, follow = true, onEvent, onLevel }) {
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
  let ctx, ws, finished = false
  // while a sound of our own plays (the mic would hear it): silence is sent
  // instead, and its loudness isn't counted as the reader's
  let mutedUntil = 0
  // everything sent, for playing the reading back
  const sent = []
  const release = () => {
    stream.getTracks().forEach(t => t.stop())
    ctx?.close().catch(() => {})
  }
  try {
    ctx = new AudioContext()
    await ctx.audioWorklet.addModule(new URL('../utils/liveCapture.worklet.js', import.meta.url))
    const node = new AudioWorkletNode(ctx, 'live-capture')
    // (connected through a silent gain so the browser keeps it running)
    const mute = ctx.createGain()
    mute.gain.value = 0
    ctx.createMediaStreamSource(stream).connect(node).connect(mute).connect(ctx.destination)
    if (ctx.state === 'suspended') await ctx.resume()

    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`)
    ws.binaryType = 'arraybuffer'
    let streaming = false
    node.port.onmessage = ({ data: { pcm, rms } }) => {
      if (!streaming) return
      const muted = performance.now() < mutedUntil
      if (!muted) onLevel?.(rms)
      const chunk = muted ? new ArrayBuffer(pcm.byteLength) : pcm
      sent.push(chunk)
      if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
    }
    ws.onopen = () => ws.send(JSON.stringify({ type: 'start', referenceText, settings, follow, tester: currentTester() }))
    ws.onmessage = e => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'ready') streaming = true
      if (msg.type === 'final') {
        finished = true
        msg = { ...msg, report: gradeFindings(msg, referenceText, settings), audio: wavBlob(sent) }
      }
      onEvent(msg)
    }
    ws.onclose = () => {
      streaming = false
      release()
      onEvent({ type: 'closed', finished })
    }
    ws.onerror = () => onEvent({ type: 'error', error: 'Lost the connection to the reader.' })
  } catch (err) {
    release()
    ws?.close()
    throw err
  }

  const sendJson = msg => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)) }
  return {
    // done reading: the server grades what's left and sends the full report
    stop() {
      stream.getTracks().forEach(t => t.stop())
      sendJson({ type: 'stop' })
    },
    cancel() { ws.close() },
    goTo(wi) { sendJson({ type: 'goto', wi }) },
    // our own sound is playing for `ms` (and a little after, for the room's echo)
    mute(ms) { mutedUntil = performance.now() + ms + 150 },
  }
}

// 16 kHz 16-bit PCM chunks → a WAV file
function wavBlob(chunks) {
  const bytes = chunks.reduce((n, c) => n + c.byteLength, 0)
  const head = new DataView(new ArrayBuffer(44))
  const text = (at, str) => { for (let i = 0; i < str.length; i++) head.setUint8(at + i, str.charCodeAt(i)) }
  text(0, 'RIFF'); head.setUint32(4, 36 + bytes, true); text(8, 'WAVE')
  text(12, 'fmt '); head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true)
  head.setUint32(24, 16000, true); head.setUint32(28, 32000, true); head.setUint16(32, 2, true); head.setUint16(34, 16, true)
  text(36, 'data'); head.setUint32(40, bytes, true)
  return new Blob([head.buffer, ...chunks], { type: 'audio/wav' })
}
