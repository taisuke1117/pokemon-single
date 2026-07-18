import type { OpponentSlot } from '@/lib/types';
import { PokemonSprite } from './PokemonSprite';

/** 対戦開始時、相手の先発をどれと仮定するか選ぶUI（実際の対戦では対戦開始後にも変更できる）。 */
export function OpponentLeadPicker({
  opponents,
  leadId,
  onChange,
}: {
  opponents: OpponentSlot[];
  leadId: string | null;
  onChange: (id: string) => void;
}) {
  const resolved = opponents.filter((o) => o.species);

  return (
    <section className="border border-hud-line bg-hud-panel p-3">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">
        相手の先発を選択（実際に出てきたら対戦画面でいつでも変更できます）
      </h3>
      {resolved.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-hud-faint">相手のポケモンが未入力です</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {resolved.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`flex items-center gap-1.5 border px-2 py-1.5 transition ${
                leadId === o.id ? 'border-hud-cyan/60 bg-hud-cyan/10' : 'border-hud-line bg-hud-panelAlt hover:bg-hud-raised'
              }`}
            >
              <PokemonSprite species={o.species} name={o.resolvedName ?? o.query} types={o.types} size="sm" />
              <span className="text-[11px] text-hud-text">{o.resolvedName}</span>
              {leadId === o.id && <span className="font-mono text-[9px] text-hud-cyan">★</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
