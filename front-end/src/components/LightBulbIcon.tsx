/**
 * LightBulbIcon — glowing bulb.
 */
type Props = { on: boolean; size?: number };
export default function LightBulbIcon({ on, size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={on ? 'animate-pulse-glow rounded-full' : ''}
      style={{ filter: on ? 'drop-shadow(0 0 6px rgba(250,204,21,.8))' : 'none' }}
    >
      <path
        d="M12 2a7 7 0 0 0-4 12.74V18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.26A7 7 0 0 0 12 2Z"
        fill={on ? '#fde68a' : '#475569'}
        stroke={on ? '#f59e0b' : '#64748b'}
        strokeWidth="1.2"
      />
      <rect x="9" y="20" width="6" height="2" rx="1" fill={on ? '#f59e0b' : '#475569'} />
    </svg>
  );
}
