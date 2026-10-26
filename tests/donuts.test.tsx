import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-donuts',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

type Drawn = { children: { props: { alt: string; height: number; source: string } }[] }

test('three cards with usage and countdown donuts above the prompt', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-26T00:00:00Z') })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('command.register', () => ({ value: { command: 'usage-donuts' } }))
  // Stands for the engine's own band once the mod passes.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const at = (minutes: number) => new Date(clock.now() + minutes * 60_000).toISOString()
  await $.session.measure({
    context: { window: 200000, tokens: 84000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 12.5, resetsAt: at(179) },
      { kind: 'seven_day', percentUsed: 71, resetsAt: at((3 * 24 + 4) * 60 - 10) },
      { kind: 'seven_day_fable', percentUsed: 93, resetsAt: at(5 * 60 - 10) },
    ],
    changed: ['context', 'rateLimits'],
  })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const cards = ((await desk.drawn()) as Drawn).children
  expect(cards.map(c => c.props.alt)).toEqual([
    '5-hour session: 13% used · resets in 2h 59m',
    'Weekly: 71% used · resets in 3d 4h',
    'Weekly Fable: 93% used',
  ])
  expect(cards.every(c => c.props.height === 40)).toBe(true)
  // The session's countdown donut shows 179 of its 300 minutes left.
  expect(cards[0]?.props.source).toContain('>2:59<')
  expect(cards[1]?.props.source).toContain('>3d4h<')
  await desk.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /5-hour/ }))?.text).toBe(
    '5-hour session 13% (2h 59m)  ·  Weekly 71% (3d 4h)  ·  Weekly Fable 93%',
  )
  await term.unmount()

  // An hour on, the minute timer has redrawn the countdowns.
  await clock.advance(60 * 60_000)
  const later = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(((await later.drawn()) as Drawn).children[0]?.props.alt).toBe('5-hour session: 13% used · resets in 1h 59m')
  await later.unmount()

  // /usage-donuts hides the band, and run again shows it.
  await $.command.run({ command: 'usage-donuts' })
  const hidden = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await hidden.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await hidden.unmount()
  await $.command.run({ command: 'usage-donuts' })
  const back = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(((await back.drawn()) as Drawn).children).toHaveLength(3)
  await back.unmount()
})
