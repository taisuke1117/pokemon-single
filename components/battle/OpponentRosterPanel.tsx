import type { BattleParticipant, OpponentSlot } from '@/lib/types';
import { PokemonSprite } from '../PokemonSprite';

const TEAM_SIZE = 3;

function hpColor(pct: number): string {
  if (pct <= 0) return 'bg-hud-faint';
  if (pct <= 25) return 'bg-advantage-strongRisk';
  if (pct <= 50) return 'bg-hud-amber';
  return 'bg-advantage-strong';
}

/**
 * 相手の選出3匹の判明状況を表示する。実際に対戦中に場に出た(seenInBattle)個体だけを
 * 「判明済み」として表示し、残りは選出3体になるまで「不明」のプレースホルダーで埋める
 * （まだ判明していない情報を憶測で表示しないため）。
 */
export function OpponentRosterPanel({
  opponents,
  participants,
  activeSlotId,
}: {
  opponents: OpponentSlot[];
  participants: Record<string, BattleParticipant>;
  activeSlotId: string;
}) {
  const revealed = opponents.filter((o) => o.seenInBattle && o.species);
  const unknownCount = Math.max(0, TEAM_SIZE - revealed.length);

  return (
    <section className="border border-hud-line bg-hud-panel p-3">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">
        相手の選出（判明 {revealed.length}/{TEAM_SIZE}）
      </h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {revealed.map((slot) => {
          const participant = participants[slot.id];
          const hp = participant?.currentHpPercent ?? 100;
          const isActive = slot.id === activeSlotId;
          return (
            <div
              key={slot.id}
              className={`flex flex-col items-center gap-1 border p-2 ${
                isActive ? 'border-hud-cyan/60 bg-hud-cyan/5' : 'border-hud-line bg-hud-panelAlt'
              }`}
            >
              <PokemonSprite species={slot.species} name={slot.resolvedName ?? slot.query} types={slot.types} size="sm" />
              <span className="max-w-full truncate text-[10px] text-hud-text">{slot.resolvedName}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-sm bg-hud-panel">
                <div className={`h-full ${hpColor(hp)}`} style={{ width: `${hp}%` }} />
              </div>
              <span className="font-mono text-[9px] text-hud-dim">{hp}%</span>
            </div>
          );
        })}
        {Array.from({ length: unknownCount }).map((_, i) => (
          <div
            key={`unknown-${i}`}
            className="flex flex-col items-center justify-center gap-1 border border-dashed border-hud-line bg-hud-panelAlt p-2 opacity-60"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-hud-faint font-display text-sm text-hud-faint">
              ?
            </span>
            <span className="text-[10px] text-hud-faint">不明</span>
          </div>
        ))}
      </div>
    </section>
  );
}
