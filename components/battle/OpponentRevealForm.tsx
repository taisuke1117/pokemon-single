'use client';

import { NATURES, natureLabel } from '@/lib/data/nature-ja';
import { COMMON_ITEMS, itemJa } from '@/lib/data/item-ja';
import { abilityJa } from '@/lib/data/ability-ja';
import type { BattleParticipant, StatLine } from '@/lib/types';

const EV_STAT_KEYS: { key: keyof StatLine; label: string }[] = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
  { key: 's', label: 'S' },
];

const selectClass =
  'border border-hud-line bg-hud-panelAlt px-1.5 py-1 text-[10px] text-hud-text focus:border-hud-cyan/50 focus:outline-none';

/**
 * 目視で判明した相手の情報（持ち物・特性・性格・努力値）を手入力するフォーム。
 * 断定入力のみ扱う（候補の絞り込みは infer.ts の推論結果側=InferencePanelが担当）。
 * ここで入力した revealed* は代表スプレッドより優先され、GT計算にも反映される
 * （lib/engine/gt/bridge/battle-state-adapter.ts の applyRevealed 参照）。
 * テラスタイプはこの対戦環境では使用しないため入力欄なし。
 */
export function OpponentRevealForm({
  participant,
  onUpdate,
  abilityOptions,
}: {
  participant: BattleParticipant;
  onUpdate: (patch: Partial<BattleParticipant>) => void;
  abilityOptions: string[];
}) {
  function setEv(key: keyof StatLine, raw: string) {
    const n = Number(raw);
    const value = raw === '' || Number.isNaN(n) ? undefined : Math.max(0, Math.min(252, n));
    const evs = { ...participant.revealedEvs, [key]: value };
    onUpdate({ revealedEvs: evs });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-hud-line pt-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-wide text-hud-faint">判明した持ち物</span>
          <select
            data-testid="reveal-item-select"
            value={participant.revealedItemId ?? ''}
            onChange={(e) => onUpdate({ revealedItemId: e.target.value || undefined })}
            className={selectClass}
          >
            <option value="">未判明</option>
            {COMMON_ITEMS.map((i) => (
              <option key={i.itemId} value={i.itemId}>
                {i.item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-wide text-hud-faint">判明した特性</span>
          <select
            data-testid="reveal-ability-select"
            value={participant.revealedAbilityId ?? ''}
            onChange={(e) => onUpdate({ revealedAbilityId: e.target.value || undefined })}
            className={selectClass}
          >
            <option value="">未判明</option>
            {abilityOptions.map((a) => (
              <option key={a} value={a}>
                {abilityJa(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-wide text-hud-faint">判明した性格</span>
          <select
            data-testid="reveal-nature-select"
            value={participant.revealedNatureId ?? ''}
            onChange={(e) => onUpdate({ revealedNatureId: e.target.value || undefined })}
            className={selectClass}
          >
            <option value="">未判明</option>
            {NATURES.map((n) => (
              <option key={n.natureId} value={n.natureId}>
                {natureLabel(n)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="text-[9px] uppercase tracking-wide text-hud-faint">判明した努力値（分かる分だけ）</span>
        <div className="mt-1 grid grid-cols-5 gap-1">
          {EV_STAT_KEYS.map(({ key, label }) => (
            <label key={key} className="flex flex-col items-center gap-0.5">
              <span className="text-[8px] text-hud-faint">{label}</span>
              <input
                type="number"
                data-testid={`reveal-ev-${key}`}
                min={0}
                max={252}
                step={4}
                placeholder="?"
                value={participant.revealedEvs?.[key] ?? ''}
                onChange={(e) => setEv(key, e.target.value)}
                className="w-full border border-hud-line bg-hud-panelAlt px-1 py-1 text-center font-mono text-[10px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
