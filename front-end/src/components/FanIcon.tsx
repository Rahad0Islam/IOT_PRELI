/**
 * FanIcon — animated rotating fan SVG. Spins only when `on` is true.
 */
type Props = { on: boolean; size?: number };
export default function FanIcon({ on, size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={on ? 'animate-spin-slow' : ''}
      style={{ filter: on ? 'drop-shadow(0 0 6px rgba(34,211,238,.6))' : 'none' }}
    >
      <circle cx="32" cy="32" r="6" fill="currentColor" />
      {Array.from({ length: 4 }).map((_, i) => (
        <ellipse
          key={i}
          cx="32"
          cy="14"
          rx="6"
          ry="14"
          fill="currentColor"
          opacity="0.85"
          transform={`rotate(${i * 90} 32 32)`}
        />
      ))}
    </svg>
  );
}
