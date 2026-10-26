export type Gauge = { percent: number | null; resetsAt?: string }

export type Gauges = {
  session: Gauge
  weekly: Gauge
  weeklyFable: Gauge
}
