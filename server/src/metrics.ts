/** Lightweight in-process telemetry for the CSMS itself (throughput, latency, errors). */
class Metrics {
  readonly startedAt = Date.now();
  private counts: Record<string, number> = { CALL: 0, CALLRESULT: 0, CALLERROR: 0 };
  private inbound = 0;
  private outbound = 0;
  /** Recent message timestamps (ms), trimmed to the last 120s. */
  private times: number[] = [];
  /** Recent outbound CALL round-trip latencies (ms). */
  private latencies: number[] = [];

  recordMessage(direction: 'in' | 'out', kind: string) {
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
    if (direction === 'in') this.inbound++;
    else this.outbound++;
    const now = Date.now();
    this.times.push(now);
    const cutoff = now - 120_000;
    if (this.times.length > 4000) this.times = this.times.filter((t) => t > cutoff);
  }

  recordLatency(ms: number) {
    this.latencies.push(ms);
    if (this.latencies.length > 300) this.latencies.shift();
  }

  snapshot(activeConnections: number) {
    const now = Date.now();
    const lastMin = this.times.filter((t) => t > now - 60_000);
    // Per-second buckets over the last 60 seconds.
    const perSecond = Array.from({ length: 60 }, (_, i) => {
      const from = now - (60 - i) * 1000;
      const to = from + 1000;
      return { s: i, count: lastMin.filter((t) => t >= from && t < to).length };
    });
    const total = this.counts.CALL + this.counts.CALLRESULT + this.counts.CALLERROR;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;

    return {
      uptimeSec: Math.round((now - this.startedAt) / 1000),
      activeConnections,
      totalMessages: total,
      inbound: this.inbound,
      outbound: this.outbound,
      byKind: this.counts,
      errorRatePct: total ? Math.round((this.counts.CALLERROR / total) * 1000) / 10 : 0,
      messagesPerMin: lastMin.length,
      avgLatencyMs: Math.round(avg),
      p95LatencyMs: Math.round(p95),
      perSecond,
    };
  }
}

export const metrics = new Metrics();
