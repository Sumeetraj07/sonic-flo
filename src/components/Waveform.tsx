interface Props {
  peaks: number[];
  progress?: number; // 0..1
  height?: number;
  active?: boolean;
}

export function Waveform({ peaks, progress = 0, height = 64, active = false }: Props) {
  const w = peaks.length;
  return (
    <svg
      viewBox={`0 0 ${w} 100`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id="wf-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.18 195)" />
          <stop offset="100%" stopColor="oklch(0.72 0.27 330)" />
        </linearGradient>
        <linearGradient id="wf-dim" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(1 0 0 / 0.25)" />
          <stop offset="100%" stopColor="oklch(1 0 0 / 0.1)" />
        </linearGradient>
      </defs>
      {peaks.map((p, i) => {
        const h = Math.max(2, p * 95);
        const y = (100 - h) / 2;
        const played = i / w < progress;
        return (
          <rect
            key={i}
            x={i + 0.15}
            y={y}
            width={0.7}
            height={h}
            fill={played || active ? "url(#wf-grad)" : "url(#wf-dim)"}
            rx={0.3}
          />
        );
      })}
    </svg>
  );
}
