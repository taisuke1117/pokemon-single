'use client';

import type { BattleParticipant, PokeType, StatKey } from '@/lib/types';
import { PokemonSprite } from '../PokemonSprite';
import { TypeBadge } from '../TypeBadge';
import { HpValueInput } from './HpValueInput';

const STATUS_OPTIONS: { value: BattleParticipant['status'] | ''; label: string }[] = [
  { value: '', label: 'なし' },
  { value: 'brn', label: 'やけど' },
  { value: 'par', label: 'まひ' },
  { value: 'psn', label: 'どく' },
  { value: 'tox', label: 'もうどく' },
  { value: 'slp', label: 'ねむり' },
  { value: 'frz', label: 'こおり' },
];

const BOOST_STATS: { key: StatKey; label: string }[] = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
  { key: 's', label: 'S' },
];

function hpColor(pct: number): string {
  if (pct <= 0) return 'bg-hud-faint';
  if (pct <= 25) return 'bg-advantage-strongRisk';
  if (pct <= 50) return 'bg-hud-amber';
  return 'bg-advantage-strong';
}

export function ActivePokemonCard({
  name,
  species,
  types,
  itemLabel,
  abilityLabel,
  participant,
  onUpdate,
  accent = 'cyan',
  revealSection,
  maxHp,
}: {
  name: string;
  species?: string;
  types?: PokeType[];
  itemLabel: string;
  abilityLabel: string;
  participant: BattleParticipant;
  onUpdate: (patch: Partial<BattleParticipant>) => void;
  accent?: 'cyan' | 'amber';
  revealSection?: React.ReactNode;
  /** 分かっている場合のみ渡す（自分のポケモンの場合、HPの実数値入力を可能にする）。 */
  maxHp?: number;
}) {
  const fainted = participant.currentHpPercent <= 0;
  const accentClass = accent === 'cyan' ? 'text-hud-cyan' : 'text-hud-amber';
  const borderClass = accent === 'cyan' ? 'border-hud-cyan/40' : 'border-hud-amber/40';

  function setBoost(key: StatKey, delta: number) {
    const cur = participant.boosts[key] ?? 0;
    const next = Math.max(-6, Math.min(6, cur + delta));
    onUpdate({ boosts: { ...participant.boosts, [key]: next } });
  }

  function setHp(pct: number) {
    onUpdate({ currentHpPercent: Math.max(0, Math.min(100, Math.round(pct))) });
  }

  return (
    <section className={`flex flex-col gap-2.5 border ${borderClass} bg-hud-panel p-3`}>
      <div className="flex items-center gap-2">
        <PokemonSprite species={species} name={name} types={types} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-base font-bold text-hud-text">{name}</h3>
            {fainted && (
              <span className="rounded-sm bg-advantage-strongRisk/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-red-200">
                戦闘不能
              </span>
            )}
          </div>
          <div className="flex gap-1">{types?.map((t) => <TypeBadge key={t} type={t} size="xs" />)}</div>
        </div>
      </div>

      {/* HPバー */}
      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-hud-dim">
          <span>HP</span>
          <span className={`font-bold ${accentClass}`}>{participant.currentHpPercent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-sm bg-hud-panelAlt">
          <div
            className={`h-full transition-all ${hpColor(participant.currentHpPercent)}`}
            style={{ width: `${participant.currentHpPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <HpValueInput
            percent={participant.currentHpPercent}
            onChangePercent={setHp}
            maxHp={maxHp}
            className="w-16 border border-hud-line bg-hud-panelAlt px-1.5 py-1 text-center font-mono text-[11px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
          />
          {[-50, -25, -10].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setHp(participant.currentHpPercent + d)}
              className="border border-hud-line px-1.5 py-1 font-mono text-[10px] text-hud-dim hover:bg-hud-panelAlt"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setHp(100)}
            className="ml-auto border border-hud-line px-1.5 py-1 font-mono text-[10px] text-hud-dim hover:bg-hud-panelAlt"
          >
            満タン
          </button>
          <button
            type="button"
            onClick={() => setHp(0)}
            className="border border-hud-line px-1.5 py-1 font-mono text-[10px] text-advantage-strongRisk hover:bg-hud-panelAlt"
          >
            瀕死
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-hud-dim">
        <div className="truncate">
          持ち物: <span className="text-hud-text">{itemLabel}</span>
        </div>
        <div className="truncate text-right">
          特性: <span className="text-hud-text">{abilityLabel}</span>
        </div>
      </div>

      {/* 状態異常 */}
      <label className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-hud-faint">状態異常</span>
        <select
          value={participant.status ?? ''}
          onChange={(e) => onUpdate({ status: (e.target.value || undefined) as BattleParticipant['status'] })}
          className="border border-hud-line bg-hud-panelAlt px-2 py-1 text-[11px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* ランク補正 */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-hud-faint">ランク補正</div>
        <div className="grid grid-cols-5 gap-1">
          {BOOST_STATS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center border border-hud-line bg-hud-panelAlt py-1">
              <span className="text-[8px] text-hud-faint">{label}</span>
              <span className="font-mono text-[11px] tabular text-hud-text">
                {(participant.boosts[key] ?? 0) > 0 ? '+' : ''}
                {participant.boosts[key] ?? 0}
              </span>
              <div className="mt-0.5 flex gap-0.5">
                <button type="button" onClick={() => setBoost(key, -1)} className="px-1 text-[10px] text-hud-dim hover:text-hud-text">
                  −
                </button>
                <button type="button" onClick={() => setBoost(key, 1)} className="px-1 text-[10px] text-hud-dim hover:text-hud-text">
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* メガ/道具消費（テラスタルはこの対戦環境では使用しないためUIから削除済み） */}
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip label="メガシンカ済み" checked={participant.megaUsed} onChange={(v) => onUpdate({ megaUsed: v })} />
        <ToggleChip
          label="道具消費済み"
          checked={participant.itemConsumed ?? false}
          onChange={(v) => onUpdate({ itemConsumed: v })}
        />
      </div>

      {revealSection}
    </section>
  );
}

function ToggleChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wide transition ${
        checked ? 'border-hud-cyan/60 bg-hud-cyan/15 text-hud-cyan' : 'border-hud-line text-hud-faint hover:bg-hud-panelAlt'
      }`}
    >
      {label}
    </button>
  );
}
