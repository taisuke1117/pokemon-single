import { TYPE_COLORS, type PokeType } from '@/lib/types';

export function TypeBadge({ type, size = 'sm' }: { type: PokeType; size?: 'xs' | 'sm' }) {
  const color = TYPE_COLORS[type];
  return (
    <span
      className={
        size === 'xs'
          ? 'inline-flex items-center rounded-sm px-1 text-[9px] font-semibold tracking-wide'
          : 'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide'
      }
      style={{
        color,
        backgroundColor: `${color}1a`,
        border: `1px solid ${color}40`,
      }}
    >
      {type}
    </span>
  );
}
