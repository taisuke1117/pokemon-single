'use client';

import type { TurnLogEvent, TurnLogKind } from '@/lib/engine/gt/battle-log';

const KIND_ICON: Record<TurnLogKind, string> = {
  move: '⚔', damage: '💥', residual: '🩸', heal: '✚', faint: '☠', status: '☣', cure: '✓',
  weather: '☁', switch: '⇄', boost: '↕', item: '🎒', ability: '✨', hazard: '▲',
  crit: '★', effectiveness: '➜', miss: '✗', cant: '💫', endturn: '―',
};

/**
 * 右端に置く対戦ログ列。advanceTurn(@pkmn/sim駆動)が返すTurnLogEventをターンごとに表示する。
 * 行動順（先手/後手）はここでの出現順がそのまま答えになる。
 */
export function BattleLogPanel({ log }: { log: TurnLogEvent[] }) {
  const byTurn = new Map<number, TurnLogEvent[]>();
  for (const e of log) {
    if (!byTurn.has(e.turn)) byTurn.set(e.turn, []);
    byTurn.get(e.turn)!.push(e);
  }
  const turns = [...byTurn.keys()].sort((a, b) => b - a);

  return (
    <section className="flex max-h-[600px] flex-col border border-hud-line bg-hud-panel p-3">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">対戦ログ</h3>
      <div className="mt-2 flex-1 overflow-y-auto">
        {turns.length === 0 && <p className="text-[11px] text-hud-faint">まだイベントがありません</p>}
        {turns.map((t) => (
          <div key={t} className="mb-2.5">
            <div className="font-mono text-[9px] font-bold text-hud-cyan">ターン{t}</div>
            <ul className="mt-1 flex flex-col gap-0.5 border-l border-hud-line pl-2">
              {byTurn.get(t)!.map((e, i) => (
                <li
                  key={i}
                  className={`text-[10px] leading-tight ${
                    e.side === 'self' ? 'text-hud-text' : e.side === 'opp' ? 'text-hud-amber' : 'text-hud-faint'
                  }`}
                >
                  <span className="mr-1">{KIND_ICON[e.kind] ?? '・'}</span>
                  {e.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
