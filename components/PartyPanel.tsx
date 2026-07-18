import type { PartyMember } from '@/lib/types';
import { TypeBadge } from './TypeBadge';
import { PokemonSprite } from './PokemonSprite';

const STAT_LABELS: { key: keyof PartyMember['stats']; label: string }[] = [
  { key: 'h', label: 'H' },
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
  { key: 's', label: 'S' },
];

export function PartyPanel({ party, onEdit }: { party: PartyMember[]; onEdit?: () => void }) {
  return (
    <section className="flex h-full flex-col border border-hud-line bg-hud-panel">
      <header className="flex items-center justify-between border-b border-hud-line px-3 py-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-hud-text">
          自軍パーティ
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-hud-dim">{party.length}/6</span>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-sm border border-hud-cyan/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-hud-cyan hover:bg-hud-cyan/10"
            >
              編集
            </button>
          )}
        </div>
      </header>

      <ul className="flex-1 divide-y divide-hud-line overflow-y-auto">
        {party.map((p, i) => (
          <li
            key={p.id}
            className="group animate-rise px-3 py-2.5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="font-mono text-[10px] text-hud-faint">{i + 1}</span>
                <PokemonSprite species={p.calc.species} name={p.name} types={p.types} size="sm" />
                <span className="truncate text-[13px] font-semibold text-hud-text">
                  {p.name}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                {p.types.map((t) => (
                  <TypeBadge key={t} type={t} size="xs" />
                ))}
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-6 gap-1">
              {STAT_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded-sm bg-hud-panelAlt px-0.5 py-0.5 text-center">
                  <div className="text-[8px] leading-none text-hud-faint">{label}</div>
                  <div className="font-mono text-[11px] leading-tight text-hud-text tabular">
                    {p.stats[key]}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-hud-dim">
              <span className="truncate">{p.item}</span>
              <span className="truncate text-right text-hud-faint">{p.ability}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
