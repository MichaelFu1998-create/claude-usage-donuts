export type Gauge = { percent: number | null; resetsAt?: string }

export type Gauges = {
  context: Gauge
  session: Gauge
  weekly: Gauge
  weeklyFable: Gauge
}
