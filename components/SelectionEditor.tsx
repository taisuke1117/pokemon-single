import type { PartyMember } from '@/lib/types';
import { PokemonSprite } from './PokemonSprite';

export interface ManualSelection {
  memberIds: string[]; // 最大3、順不同
  leadId: string | null;
}

export function SelectionEditor({
  party,
  selection,
  onChange,
  onResetToRecommended,
  isManual,
}: {
  party: PartyMember[];
  selection: ManualSelection;
  onChange: (next: ManualSelection) => void;
  onResetToRecommended: () => void;
  isManual: boolean;
}) {
  function toggleMember(id: string) {
    const included = selection.memberIds.includes(id);
    if (included) {
      const memberIds = selection.memberIds.filter((m) => m !== id);
      const leadId = selection.leadId === id ? memberIds[0] ?? null : selection.leadId;
      onChange({ memberIds, leadId });
      return;
    }
    if (selection.memberIds.length >= 3) return;
    const memberIds = [...selection.memberIds, id];
    onChange({ memberIds, leadId: selection.leadId ?? id });
  }

  return (
    <section className="border border-hud-line bg-hud-panel p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">
          選出編集（{selection.memberIds.length}/3）
        </h3>
        {isManual && (
          <button
            type="button"
            onClick={onResetToRecommended}
            className="font-mono text-[10px] text-hud-cyan hover:underline"
          >
            推奨選出に戻す
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] text-hud-faint">
        クリックで選出/解除。選出済みの1匹をクリックすると先発に指定できます（★）。
      </p>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {party.map((m) => {
          const picked = selection.memberIds.includes(m.id);
          const isLead = selection.leadId === m.id;
          return (
            <div
              key={m.id}
              className={`flex flex-col items-center gap-1 border p-1.5 transition ${
                picked ? 'border-hud-cyan/60 bg-hud-cyan/10' : 'border-hud-line bg-hud-panelAlt hover:bg-hud-raised'
              }`}
            >
              <button type="button" onClick={() => toggleMember(m.id)} className="flex flex-col items-center gap-1">
                <PokemonSprite species={m.calc.species} name={m.name} types={m.types} size="sm" />
                <span className="max-w-[72px] truncate text-center text-[10px] text-hud-text">{m.name}</span>
              </button>
              {picked && (
                <button
                  type="button"
                  onClick={() => onChange({ ...selection, leadId: m.id })}
                  className={`font-mono text-[9px] uppercase tracking-wide ${
                    isLead ? 'text-hud-amber' : 'text-hud-faint hover:text-hud-dim'
                  }`}
                >
                  {isLead ? '★ 先発' : '先発にする'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
