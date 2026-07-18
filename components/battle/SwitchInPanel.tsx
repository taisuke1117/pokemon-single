import { moveJa } from '@/lib/data/move-ja';
import type { SwitchInRankEntry } from '@/lib/engine/battle';
import type { PartyMember } from '@/lib/types';
import { PokemonSprite } from '../PokemonSprite';

export function SwitchInPanel({
  bench,
  ranking,
  onSwitchIn,
  urgent,
  trapped,
}: {
  bench: PartyMember[];
  ranking: SwitchInRankEntry[];
  onSwitchIn: (member: PartyMember) => void;
  /** 場のポケモンが瀕死等で、交代先の選択が必須の状態か */
  urgent?: boolean;
  /** こだわり系ロック/ありじごく/くろいまなざし等で交代不可の状態か（瀕死時は無関係なので urgent 時は無視）。 */
  trapped?: boolean;
}) {
  const threatMoveId = ranking.find((r) => r.threatMoveId)?.threatMoveId;
  const blockSwitch = Boolean(trapped) && !urgent;

  return (
    <section
      className={`flex flex-col gap-2 border p-3 ${
        urgent ? 'border-advantage-strongRisk/60 bg-advantage-strongRisk/5 shadow-amberGlow' : 'border-hud-line bg-hud-panel'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">
          {urgent ? '次のポケモンを選出' : '交代候補'}
        </h3>
        {threatMoveId && (
          <span className="font-mono text-[9px] text-hud-dim">
            警戒技: {moveJa(threatMoveId)}
          </span>
        )}
      </div>

      {blockSwitch && (
        <p className="text-[10px] text-advantage-strongRisk">交代不可の状態です（ありじごく・くろいまなざし・かげふみ等）</p>
      )}

      {ranking.length === 0 ? (
        <p className="text-[11px] text-hud-faint">控えがいません</p>
      ) : (
        <ul className="divide-y divide-hud-line">
          {ranking.map((r) => {
            const member = bench.find((m) => m.id === r.memberId);
            if (!member) return null;
            return (
              <li key={r.memberId} className="flex items-center justify-between gap-2 py-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <PokemonSprite species={member.calc.species} name={member.name} types={member.types} size="sm" />
                  <span className="truncate text-[12px] text-hud-text">{member.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] tabular">
                  <span className={r.survives ? 'text-hud-cyan' : 'text-advantage-strongRisk'}>{r.range}</span>
                  <span className="text-hud-dim">{r.koText}</span>
                  <button
                    type="button"
                    onClick={() => onSwitchIn(member)}
                    disabled={blockSwitch}
                    className="border border-hud-cyan/50 bg-hud-cyan/10 px-2 py-1 font-mono text-[10px] uppercase text-hud-cyan transition enabled:hover:bg-hud-cyan/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    交代
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
