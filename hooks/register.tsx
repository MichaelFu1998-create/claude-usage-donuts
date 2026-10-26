import type { Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Gauge, Gauges } from '../types'

const EMPTY: Gauge = { percent: null }

// Kept in the module: session.start re-reads usage after a hot reload.
let now: Gauges = { context: EMPTY, session: EMPTY, weekly: EMPTY, weeklyFable: EMPTY }

const DONUTS: { id: keyof Gauges; label: string }[] = [
  { id: 'context', label: 'Context' },
  { id: 'session', label: 'Session' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'weeklyFable', label: 'Fable wk' },
]

// The engine names windows `five_hour`, `seven_day` and `spend_limit`; a
// model-specific weekly window arrives as another kind, matched loosely.
function isFableWeekly(kind: string) {
  return /fable/i.test(kind) || (/seven_day|weekly/i.test(kind) && kind !== 'seven_day')
}

function toGauges(context: SessionContextUsage, limits: readonly SessionRateLimit[]): Gauges {
  const pick = (match: (kind: string) => boolean): Gauge => {
    const limit = limits.find(l => match(l.kind))
    return limit ? { percent: limit.percentUsed, resetsAt: limit.resetsAt } : EMPTY
  }

  return {
    context: { percent: context.percent ?? null },
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

function donutSvg(label: string, gauge: Gauge) {
  const r = 16
  const c = 2 * Math.PI * r
  const p = gauge.percent === null ? 0 : Math.min(100, Math.max(0, gauge.percent))
  const dash = (p / 100) * c
  const value = gauge.percent === null ? '—' : `${Math.round(gauge.percent)}%`
  const arc =
    gauge.percent === null
      ? ''
      : `<circle cx="22" cy="22" r="${r}" fill="none" stroke="${colorFor(p)}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 22 22)"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="62" viewBox="-6 0 56 62">
<style>.t{fill:#555;font:600 10px -apple-system,system-ui,sans-serif}.l{fill:#888;font:9px -apple-system,system-ui,sans-serif}.k{stroke:#ddd}
@media (prefers-color-scheme: dark){.t{fill:#ddd}.l{fill:#999}.k{stroke:#444}}</style>
<circle class="k" cx="22" cy="22" r="${r}" fill="none" stroke-width="5"/>${arc}
<text class="t" x="22" y="25.5" text-anchor="middle">${value}</text>
<text class="l" x="22" y="56" text-anchor="middle">${label}</text>
</svg>`
}

function describe(label: string, gauge: Gauge) {
  if (gauge.percent === null) return `${label}: no reading`
  const resets = gauge.resetsAt ? `, resets ${new Date(gauge.resetsAt).toLocaleString()}` : ''
  return `${label}: ${gauge.percent}% used${resets}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    now = toGauges(usage.context, usage.rateLimits)
    $.ui.invalidate('ui.render')
    return result
  })

  on('session.measure', async ($, e, next) => {
    now = toGauges(e.context, e.rateLimits)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // The dim hint line under the prompt: the engine's hint on the left, the
  // donuts on the right; the terminal keeps its line and gets the figures as a tail.
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    const ui = $.ui.resolve(e)

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Box, Svg, Text } = ui
      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text dimColor>{e.props.hint}</Text>
          <Box flexDirection="row" gap={1}>
            {DONUTS.map(d => (
              <Svg source={donutSvg(d.label, now[d.id])} alt={describe(d.label, now[d.id])} width={56} height={62} />
            ))}
          </Box>
        </Box>
      )
    }

    const tail = DONUTS.map(d => `${d.label} ${now[d.id].percent === null ? '—' : `${Math.round(now[d.id].percent!)}%`}`).join(' · ')
    return next({ ...e, props: { ...e.props, tail } })
  })
}
