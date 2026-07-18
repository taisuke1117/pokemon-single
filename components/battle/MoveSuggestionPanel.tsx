import { moveJa } from '@/lib/data/move-ja';
import type { MoveRankEntry, SpeedResult } from '@/lib/engine/battle';

const SPEED_LABEL: Record<SpeedResult, { label: string; className: string }> = {
  selfFirst: { label: '先制できる', className: 'text-hud-cyan' },
  oppFirst: { label: '後手を取られる', className: 'text-advantage-strongRisk' },
  speedTie: { label: '素早さ同値（50%）', className: 'text-hud-amber' },
};

export function MoveSuggestionPanel({ moves, speed }: { moves: MoveRankEntry[]; speed: SpeedResult }) {
  return (
    <section className="flex flex-col gap-2 border border-hud-line bg-hud-panel p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">
          技の与ダメージ予測
        </h3>
        <span className={`font-mono text-[10px] font-bold ${SPEED_LABEL[speed].className}`}>
          {SPEED_LABEL[speed].label}
        </span>
      </div>

      {moves.length === 0 ? (
        <p className="text-[11px] text-hud-faint">相手の型が未確定のため計算できません</p>
      ) : (
        <ul className="divide-y divide-hud-line">
          {moves.map((m, i) => (
            <li key={m.moveId} className="flex items-center justify-between gap-2 py-1.5">
              <div className="flex items-center gap-1.5">
                {i === 0 && <span className="font-mono text-[9px] text-hud-amber">推奨</span>}
                <span className="text-[12px] text-hud-text">{moveJa(m.moveId)}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] tabular">
                <span className="text-hud-text">{m.range}</span>
                <span className="text-hud-dim">{m.koText}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
