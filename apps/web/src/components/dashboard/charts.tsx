'use client';

type BarItem = { label: string; value: number; hint?: string };

export function HBarChart({
  items,
  valuePrefix = '',
  emptyText = 'No data',
}: {
  items: BarItem[];
  valuePrefix?: string;
  emptyText?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="muted">{emptyText}</p>;
  return (
    <div className="dash-hbar">
      {items.map((item) => (
        <div key={item.label} className="dash-hbar-row">
          <div className="dash-hbar-label" title={item.label}>
            {item.label}
          </div>
          <div className="dash-hbar-track">
            <div
              className="dash-hbar-fill"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <div className="dash-hbar-value">
            {valuePrefix}
            {typeof item.value === 'number' && valuePrefix === '₹'
              ? item.value.toLocaleString('en-IN', {
                  maximumFractionDigits: 0,
                })
              : item.value}
            {item.hint ? (
              <span className="muted"> · {item.hint}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function VBarChart({
  items,
  emptyText = 'No data',
}: {
  items: BarItem[];
  emptyText?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="muted">{emptyText}</p>;
  return (
    <div className="dash-vbar">
      {items.map((item) => (
        <div key={item.label} className="dash-vbar-col">
          <div className="dash-vbar-value">{item.value}</div>
          <div className="dash-vbar-track">
            <div
              className="dash-vbar-fill"
              style={{ height: `${(item.value / max) * 100}%` }}
            />
          </div>
          <div className="dash-vbar-label" title={item.label}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  items,
  emptyText = 'No data',
}: {
  items: Array<{ label: string; value: number; color: string }>;
  emptyText?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <p className="muted">{emptyText}</p>;

  let angle = 0;
  const stops: string[] = [];
  for (const item of items) {
    const next = angle + (item.value / total) * 360;
    stops.push(`${item.color} ${angle}deg ${next}deg`);
    angle = next;
  }

  return (
    <div className="dash-donut-wrap">
      <div
        className="dash-donut"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      >
        <div className="dash-donut-hole">
          <strong>{total}</strong>
          <span className="muted">total</span>
        </div>
      </div>
      <ul className="dash-donut-legend">
        {items.map((item) => (
          <li key={item.label}>
            <span
              className="dash-dot"
              style={{ background: item.color }}
            />
            {item.label}
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineAreaChart({
  items,
  emptyText = 'No data',
}: {
  items: Array<{ label: string; value: number }>;
  emptyText?: string;
}) {
  if (!items.length) return <p className="muted">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const w = 320;
  const h = 120;
  const pad = 8;
  const pts = items.map((item, i) => {
    const x =
      pad + (i / Math.max(items.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (item.value / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const area = `${pad},${h - pad} ${pts.join(' ')} ${w - pad},${h - pad}`;

  return (
    <div className="dash-line">
      <svg viewBox={`0 0 ${w} ${h}`} className="dash-line-svg" role="img">
        <polyline
          fill="none"
          stroke="var(--main-primary)"
          strokeWidth="2.5"
          points={pts.join(' ')}
        />
        <polygon
          points={area}
          fill="color-mix(in srgb, var(--main-primary) 18%, transparent)"
        />
      </svg>
      <div className="dash-line-labels">
        <span>{items[0]?.label}</span>
        <span>{items[items.length - 1]?.label}</span>
      </div>
    </div>
  );
}
