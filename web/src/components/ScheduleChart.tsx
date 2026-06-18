import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Period {
  startPeriod: number;
  limit: number;
}

/** Render a charging schedule (startPeriod seconds → limit) as a 24h step line. */
export function ScheduleChart({ periods }: { periods: Period[] }) {
  if (!periods?.length) return null;
  const sorted = [...periods].sort((a, b) => a.startPeriod - b.startPeriod);
  const data: { h: number; limit: number }[] = [];
  for (let h = 0; h <= 24; h++) {
    const sec = h * 3600;
    let limit = sorted[0].limit;
    for (const p of sorted) if (p.startPeriod <= sec) limit = p.limit;
    data.push({ h, limit });
  }
  return (
    <div className="h-36 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -22, right: 8, top: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
          <XAxis dataKey="h" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} ticks={[0, 6, 12, 18, 24]} tickFormatter={(h) => `${h}:00`} />
          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={{ background: '#0f1620', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(h) => `${h}:00`}
            formatter={(v: number) => [`${v} A`, 'Limit']}
          />
          <Line type="stepAfter" dataKey="limit" stroke="#22d3ee" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
