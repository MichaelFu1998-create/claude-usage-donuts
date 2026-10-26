import { expect, test } from 'claude-code/testing'

const HINT = {
  plugin: 'usage-donuts',
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

test('four gauges follow the measured usage', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { window: 200000, tokens: 84000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 12.5 },
      { kind: 'seven_day', percentUsed: 71 },
      { kind: 'seven_day_fable', percentUsed: 93 },
    ],
    changed: ['context', 'rateLimits'],
  })

  const desk = await $.ui.mount({ ...HINT, surface: 'desktop' })
  const drawn = (await desk.drawn()) as { children: [{ children: unknown }, { children: { props: { alt: string } }[] }] }
  expect(drawn.children[1].children.map(c => c.props.alt)).toEqual([
    'Context: 42% used',
    'Session: 12.5% used',
    'Weekly: 71% used',
    'Fable wk: 93% used',
  ])
  expect(await desk.find({ type: 'Text', text: /for shortcuts/ })).toBeDefined()
  await desk.unmount()
})
