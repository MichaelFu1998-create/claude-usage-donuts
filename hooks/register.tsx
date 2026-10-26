import type { Register, SessionRateLimit } from 'claude-code'

import type { Gauge, Gauges } from '../types'

const EMPTY: Gauge = { percent: null }

// Kept in the module: session.start re-reads usage after a hot reload.
let now: Gauges = { session: EMPTY, weekly: EMPTY, weeklyFable: EMPTY }
// Hidden and shown again with /usage-donuts.
let isClosed = false

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Each gauge, and the window its countdown donut runs over; Weekly Fable shows
// usage alone.
const GAUGES: { id: keyof Gauges; label: string; windowMs?: number }[] = [
  { id: 'session', label: '5-hour session', windowMs: 5 * HOUR },
  { id: 'weekly', label: 'Weekly', windowMs: 7 * DAY },
  { id: 'weeklyFable', label: 'Weekly Fable' },
]

// The engine names windows `five_hour`, `seven_day` and `spend_limit`; a
// model-specific weekly window arrives as another kind, matched loosely.
function isFableWeekly(kind: string) {
  return /fable/i.test(kind) || (/seven_day|weekly/i.test(kind) && kind !== 'seven_day')
}

function toGauges(limits: readonly SessionRateLimit[]): Gauges {
  const pick = (match: (kind: string) => boolean): Gauge => {
    const limit = limits.find(l => match(l.kind))
    return limit ? { percent: limit.percentUsed, resetsAt: limit.resetsAt } : EMPTY
  }

  return {
    session: pick(kind => kind === 'five_hour'),
    weekly: pick(kind => kind === 'seven_day'),
    weeklyFable: pick(isFableWeekly),
  }
}

function colorFor(percent: number) {
  if (percent > 75) return '#d9534f'
  if (percent >= 50) return '#e8873a'
  if (percent >= 25) return '#d4b62a'
  return '#3fa66b'
}

function msLeft(gauge: Gauge, nowMs: number) {
  if (!gauge.resetsAt) return null
  const ms = Date.parse(gauge.resetsAt) - nowMs
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

// Hours and minutes inside the 5-hour window; days and hours for a weekly one.
// `isCompact` is the form the countdown donut's centre has room for.
function formatLeft(ms: number, windowMs: number, isCompact = false) {
  if (windowMs <= 5 * HOUR) {
    const total = Math.ceil(ms / MINUTE)
    const [h, m] = [Math.floor(total / 60), total % 60]
    if (isCompact) return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}m`
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  const total = Math.ceil(ms / HOUR)
  const [d, h] = [Math.floor(total / 24), total % 24]
  if (d === 0) return `${h}h`
  return isCompact ? `${d}d${h}h` : `${d}d ${h}h`
}

function percentText(gauge: Gauge) {
  return gauge.percent === null ? '—' : `${Math.round(gauge.percent)}%`
}

const H = 40
const R = 13
const C = 2 * Math.PI * R

function ring(cx: number, fraction: number | null, color: string, centre: string) {
  const arc =
    fraction === null
      ? ''
      : `<circle cx="${cx}" cy="20" r="${R}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${Math.max(0, Math.min(1, fraction)) * C} ${C}" transform="rotate(-90 ${cx} 20)"/>`
  return `<circle class="k" cx="${cx}" cy="20" r="${R}" fill="none" stroke-width="4"/>${arc}<text class="c" x="${cx}" y="23" text-anchor="middle"${centre.length > 3 ? ' style="font-size:6.5px"' : ''}>${centre}</text>`
}

// One card, 40px high: the usage donut, the countdown donut when the window
// resets, and the name with a line of detail beside them.
function cardSvg(g: (typeof GAUGES)[number], gauge: Gauge, nowMs: number) {
  const usage = ring(20, gauge.percent === null ? null : gauge.percent / 100, gauge.percent === null ? '#999' : colorFor(gauge.percent), percentText(gauge))
  const left = g.windowMs ? msLeft(gauge, nowMs) : null
  const countdown = g.windowMs ? ring(54, left === null ? null : left / g.windowMs, '#4a90d9', left === null ? '—' : formatLeft(left, g.windowMs, true)) : ''
  const textX = g.windowMs ? 76 : 42
  const detail =
    gauge.percent === null
      ? 'no reading yet'
      : `${percentText(gauge)} used${left === null || !g.windowMs ? '' : ` · resets in ${formatLeft(left, g.windowMs)}`}`
  const width = textX + Math.max(g.label.length * 6.6, detail.length * 5.4) + 6

  return {
    width: Math.ceil(width),
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${H}" viewBox="0 0 ${Math.ceil(width)} ${H}">
<style>.c{fill:#555;font:600 8px -apple-system,system-ui,sans-serif}.n{fill:#333;font:600 11px -apple-system,system-ui,sans-serif}.d{fill:#888;font:10px -apple-system,system-ui,sans-serif}.k{stroke:#e2e2e2}
@media (prefers-color-scheme: dark){.c{fill:#ddd}.n{fill:#eee}.d{fill:#999}.k{stroke:#444}}</style>
${usage}${countdown}
<text class="n" x="${textX}" y="17">${g.label}</text>
<text class="d" x="${textX}" y="30">${detail}</text>
</svg>`,
    alt: `${g.label}: ${detail}`,
  }
}

function textLine(nowMs: number) {
  return GAUGES.map(g => {
    const gauge = now[g.id]
    const left = g.windowMs ? msLeft(gauge, nowMs) : null
    return `${g.label} ${percentText(gauge)}${left === null || !g.windowMs ? '' : ` (${formatLeft(left, g.windowMs)})`}`
  }).join('  ·  ')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'usage-donuts', description: 'Show or hide the usage donuts above the prompt' })
    const usage = await $.session.usage()
    now = toGauges(usage.rateLimits)
    $.ui.invalidate('ui.render')
    // Redraw each minute so the countdowns move between replies.
    $.clock.every(MINUTE, () => $.ui.invalidate('ui.render'))
    return result
  })

  on('session.measure', async ($, e, next) => {
    now = toGauges(e.rateLimits)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'usage-donuts' }, async $ => {
    isClosed = !isClosed
    $.ui.invalidate('ui.render')
    return { text: isClosed ? 'Usage donuts hidden.' : 'Usage donuts shown.' }
  })

  // The band directly above the prompt: room for the full names, and the one
  // site under the transcript where the desktop draws a mod's Svg.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || isClosed) return next(e)

    const nowMs = await $.clock.now()
    const ui = $.ui.resolve(e)

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Box, Svg } = ui
      return (
        <Box flexDirection="row" flexWrap="wrap" justifyContent="flex-end" gap={2}>
          {GAUGES.map(g => {
            const card = cardSvg(g, now[g.id], nowMs)
            return <Svg source={card.source} alt={card.alt} width={card.width} height={H} />
          })}
        </Box>
      )
    }

    const { Box, Text } = ui
    return (
      <Box flexDirection="row" justifyContent="flex-end">
        <Text dimColor>{textLine(nowMs)}</Text>
      </Box>
    )
  })
}
