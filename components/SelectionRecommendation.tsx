import type { PartyMember, SelectionPick } from '@/lib/types';
import { TypeBadge } from './TypeBadge';
import { PokemonSprite } from './PokemonSprite';

export function SelectionRecommendation({
  party,
  picks,
  warnings,
}: {
  party: PartyMember[];
  picks: SelectionPick[];
  warnings: string[];
}) {
  return (
    <section className="grid grid-cols-1 gap-px bg-hud-line lg:grid-cols-[1fr_1fr_1fr_0.8fr]">
      {picks.map((pick, i) => {
        const member = party.find((p) => p.id === pick.memberId);
        if (!member) return null;
        return (
          <article
            key={pick.memberId}
            className="animate-rise flex flex-col gap-2.5 border-t-2 border-hud-amber/60 bg-hud-panel p-3.5 shadow-amberGlow"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-amber">
                {pick.role} #{i + 1}
              </span>
              <div className="flex gap-1">
                {member.types.map((t) => (
                  <TypeBadge key={t} type={t} size="xs" />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PokemonSprite species={member.calc.species} name={member.name} types={member.types} size="md" />
              <h3 className="font-display text-lg font-bold leading-none text-hud-text">
                {member.name}
              </h3>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-hud-dim">
                採用理由
              </div>
              <ul className="space-y-1">
                {pick.reasons.map((r, idx) => (
                  <li key={idx} className="flex gap-1.5 text-[11px] leading-snug text-hud-text">
                    <span className="mt-0.5 text-hud-cyan">＋</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1 border-t border-hud-line pt-2">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-advantage-mildRisk">
                警戒点
              </div>
              <ul className="space-y-1">
                {pick.watchOut.map((w, idx) => (
                  <li key={idx} className="flex gap-1.5 text-[11px] leading-snug text-hud-dim">
                    <span className="mt-0.5 text-advantage-mildRisk">！</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        );
      })}

      <aside className="flex flex-col gap-2 border-t-2 border-hud-cyan/50 bg-hud-panel p-3.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-cyan">
          全体所見
        </span>
        <ul className="space-y-2">
          {warnings.map((w, idx) => (
            <li key={idx} className="flex gap-1.5 text-[11px] leading-snug text-hud-text">
              <span className="mt-0.5 text-hud-cyan">▸</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
