// Ringback (you are calling) and ringtone (someone is calling you) for the FreePBX phone.
// Generated with the Web Audio API, so there are no sound files to ship.

let context = null
let timer = null
let sounding = []

function getContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)()
  }
  return context
}

// Browsers keep audio suspended until the page has had a click or key press.
export function unlockAudio() {
  const resume = () => getContext().resume().catch(() => {})
  resume()
  for (const type of ['pointerdown', 'keydown']) {
    document.addEventListener(type, resume, { once: true })
  }
}

function burst(frequencies, startAt, length, volume) {
  const ctx = getContext()
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.02)
  gain.gain.setValueAtTime(volume, startAt + length - 0.02)
  gain.gain.linearRampToValueAtTime(0, startAt + length)
  gain.connect(ctx.destination)

  for (const frequency of frequencies) {
    const osc = ctx.createOscillator()
    osc.frequency.value = frequency
    osc.connect(gain)
    osc.start(startAt)
    osc.stop(startAt + length)
    sounding.push(osc)
    osc.onended = () => {
      sounding = sounding.filter((o) => o !== osc)
    }
  }
}

function loop(pattern) {
  stopTones()
  const run = () => {
    const ctx = getContext()
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {})
      timer = setTimeout(run, 500)
      return
    }
    const start = ctx.currentTime + 0.05
    for (const [offset, length] of pattern.bursts) {
      burst(pattern.frequencies, start + offset, length, pattern.volume)
    }
    timer = setTimeout(run, pattern.period * 1000)
  }
  run()
}

export function startRingback() {
  loop({ frequencies: [400, 450], bursts: [[0, 0.4], [0.6, 0.4]], period: 3, volume: 0.1 })
}

export function startRingtone() {
  loop({
    frequencies: [660, 880],
    bursts: [
      [0.00, 0.16],
      [0.22, 0.16],
      [0.65, 0.16],
      [0.87, 0.16],
    ],
    period: 2.8,
    volume: 0.14,
  })
}

export function stopTones() {
  clearTimeout(timer)
  timer = null
  for (const osc of sounding) {
    try {
      osc.stop()
    } catch {
      /* already stopped */
    }
  }
  sounding = []
}