'use client';

import { useMemo, useState } from 'react';
import { usePartyStore } from '@/store/party-store';
import { hydrateStats, type PartyMemberSeed } from '@/lib/data/hydrate';
import { searchFullCatalog, getCatalogEntry, type SpeciesCatalogEntry } from '@/lib/data/species-catalog';
import { findEnvEntryBySpecies } from '@/lib/data/env-season-m4';
import { getSpecies, getChampionsSpecies } from '@/lib/calc/dex';
import { toJaTypes } from '@/lib/data/type-map';
import { NATURES, natureLabel, findNature } from '@/lib/data/nature-ja';
import { COMMON_ITEMS, itemJa } from '@/lib/data/item-ja';
import { abilityJa } from '@/lib/data/ability-ja';
import { moveJa } from '@/lib/data/move-ja';
import { TypeBadge } from './TypeBadge';
import { PokemonSprite } from './PokemonSprite';
import type { StatLine } from '@/lib/types';

const STAT_FIELDS: { key: keyof StatLine; label: string }[] = [
  { key: 'h', label: 'H' },
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
  { key: 's', label: 'S' },
];

export function PartyEditor({ onClose }: { onClose: () => void }) {
  const seeds = usePartyStore((s) => s.seeds);
  const setMember = usePartyStore((s) => s.setMember);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col border border-hud-line bg-hud-panel shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hud-line px-4 py-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-hud-text">
            パーティ編集
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs text-hud-dim hover:text-hud-text"
          >
            閉じる ✕
          </button>
        </header>

        <div className="flex gap-px overflow-x-auto bg-hud-line">
          {seeds.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`flex min-w-[84px] flex-1 flex-col items-center gap-1 bg-hud-panel px-2 py-2 transition ${
                i === activeIndex ? 'bg-hud-raised ring-1 ring-inset ring-hud-cyan' : 'hover:bg-hud-panelAlt'
              }`}
            >
              <PokemonSprite species={s.calc.species} name={s.name} size="sm" />
              <span className="w-full truncate text-center text-[10px] text-hud-text">{s.name}</span>
            </button>
          ))}
        </div>

        <div className="overflow-y-auto">
          <SlotEditor
            key={seeds[activeIndex].id}
            seed={seeds[activeIndex]}
            onSave={(next) => setMember(activeIndex, next)}
          />
        </div>
      </div>
    </div>
  );
}

function SlotEditor({ seed, onSave }: { seed: PartyMemberSeed; onSave: (s: PartyMemberSeed) => void }) {
  const [draft, setDraft] = useState<PartyMemberSeed>(seed);
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [moveQuery, setMoveQuery] = useState('');
  const [dirty, setDirty] = useState(false);

  const dexSpecies = getSpecies(draft.calc.species);
  const catalogEntry = getCatalogEntry(draft.calc.species);
  const isMega = dexSpecies?.isMega ?? false;
  const abilities = dexSpecies?.abilities ?? [];

  // ベース種族に対応するメガ候補（複数あるフォルム違いも含む）。
  // メガストーンを持たせておけば対戦中にメガシンカできる、という運用を想定し、
  // ベース種族のまま登録しても持ち物選択肢にメガストーンを出せるようにする
  // （「メガ種族として登録する」＝持ち物固定、とは別の選択肢として提供する）。
  const megaVariants = isMega ? [] : getChampionsSpecies().filter((s) => s.isMega && s.baseSpecies === draft.calc.species);
  const itemOptions = [
    ...COMMON_ITEMS,
    ...megaVariants
      .filter((v) => v.requiredItem && !COMMON_ITEMS.some((i) => i.itemId === v.requiredItem))
      .map((v) => ({ itemId: v.requiredItem as string, item: itemJa(v.requiredItem as string) })),
  ];

  const moveCandidates = useMemo(() => {
    const q = moveQuery.trim().toLowerCase();
    const all = catalogEntry?.moves ?? [];
    const list = q ? all.filter((m) => m.toLowerCase().includes(q) || moveJa(m).includes(q)) : all;
    return [...list].sort((a, b) => moveJa(a).localeCompare(moveJa(b), 'ja')).slice(0, 60);
  }, [catalogEntry, moveQuery]);

  const speciesResults = useMemo(() => searchFullCatalog(speciesQuery, 10), [speciesQuery]);

  const previewStats = useMemo(() => hydrateStats(draft.calc), [draft.calc]);
  const evSum = Object.values(draft.calc.evs).reduce((a, b) => a + (b ?? 0), 0);
  const evOver = evSum > 508;

  function setDraftAndDirty(updater: (d: PartyMemberSeed) => PartyMemberSeed) {
    setDraft(updater);
    setDirty(true);
  }

  function pickSpecies(entry: SpeciesCatalogEntry) {
    // 環境データ(使用率あり)に登録済みなら、その代表傾向+採用率上位技を初期値にする
    // （表示名はメガ判別のため加工しているので、一意な種族IDで引く）
    const envEntry = findEnvEntryBySpecies(entry.species);
    const primary = envEntry ? [...envEntry.spreads].sort((a, b) => b.prob - a.prob)[0] : undefined;
    const topMoveIds = envEntry
      ? [...envEntry.moveUsage].sort((a, b) => b.usage - a.usage).slice(0, 4).map((m) => m.moveId)
      : [];

    setDraftAndDirty((d) => ({
      ...d,
      name: entry.name,
      item: primary?.item ?? '',
      ability: primary ? primary.ability : abilityJa(entry.abilities[0] ?? ''),
      nature: primary?.nature ?? 'まじめ',
      moves: topMoveIds.map((id) => moveJa(id)),
      isMega: entry.isMega,
      calc: {
        species: entry.species,
        itemId: primary?.itemId,
        abilityId: primary?.abilityId ?? entry.abilities[0],
        natureId: primary?.natureId ?? 'Serious',
        evs: primary?.evs ?? {},
        moveIds: topMoveIds,
      },
    }));
    setSpeciesQuery('');
  }

  function setEv(key: keyof StatLine, value: number) {
    setDraftAndDirty((d) => ({ ...d, calc: { ...d.calc, evs: { ...d.calc.evs, [key]: value } } }));
  }

  function setMoveAt(index: number, moveId: string) {
    setDraftAndDirty((d) => {
      const moves = [...d.moves];
      const moveIds = [...(d.calc.moveIds ?? [])];
      moves[index] = moveJa(moveId);
      moveIds[index] = moveId;
      return { ...d, moves, calc: { ...d.calc, moveIds } };
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr]">
      {/* 種族選択 */}
      <section className="border border-hud-line bg-hud-panelAlt">
        <header className="border-b border-hud-line px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hud-faint">
            種族（全約970種・使用率データありを優先表示）
          </span>
        </header>
        <div className="p-2">
          <input
            value={speciesQuery}
            onChange={(e) => setSpeciesQuery(e.target.value)}
            placeholder="ポケモン名で検索..."
            className="mb-2 w-full border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text placeholder:text-hud-faint focus:border-hud-cyan/50 focus:outline-none"
          />
          <ul className="max-h-[360px] space-y-0.5 overflow-y-auto">
            {speciesResults.map((e) => (
              <li key={e.species}>
                <button
                  type="button"
                  onClick={() => pickSpecies(e)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-hud-cyan/10 ${
                    e.species === draft.calc.species ? 'bg-hud-cyan/10 ring-1 ring-inset ring-hud-cyan/40' : ''
                  }`}
                >
                  <PokemonSprite species={e.species} name={e.name} types={e.types} size="sm" />
                  <span className="flex-1 truncate text-[12px] text-hud-text">{e.name}</span>
                  <span className="font-mono text-[10px] tabular text-hud-faint">
                    {e.rank !== undefined ? `${e.rank}位` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 詳細フォーム */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3 border border-hud-line bg-hud-panelAlt px-3 py-3">
          <PokemonSprite species={draft.calc.species} name={draft.name} types={toJaTypes(dexSpecies?.types ?? [])} size="lg" />
          <div>
            <div className="font-display text-xl font-bold text-hud-text">{draft.name}</div>
            <div className="mt-1 flex gap-1">
              {toJaTypes(dexSpecies?.types ?? []).map((t) => (
                <TypeBadge key={t} type={t} size="xs" />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 持ち物 */}
          <Field label="持ち物">
            {isMega ? (
              <ReadonlyValue value={itemJa(draft.calc.itemId ?? '')} note="メガシンカ固定" />
            ) : (
              <select
                value={draft.calc.itemId ?? ''}
                onChange={(e) => {
                  const chosen = itemOptions.find((i) => i.itemId === e.target.value);
                  setDraftAndDirty((d) => ({
                    ...d,
                    item: chosen?.item ?? '',
                    calc: { ...d.calc, itemId: chosen?.itemId },
                  }));
                }}
                className={selectClass}
              >
                <option value="">未選択</option>
                {itemOptions.map((i) => (
                  <option key={i.itemId} value={i.itemId}>
                    {i.item}
                    {megaVariants.some((v) => v.requiredItem === i.itemId) ? '（メガシンカ用）' : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* 特性 */}
          <Field label="特性">
            {isMega || abilities.length <= 1 ? (
              <ReadonlyValue value={abilityJa(abilities[0] ?? draft.ability)} note={isMega ? 'メガシンカ固定' : undefined} />
            ) : (
              <select
                value={draft.calc.abilityId ?? ''}
                onChange={(e) =>
                  setDraftAndDirty((d) => ({
                    ...d,
                    ability: abilityJa(e.target.value),
                    calc: { ...d.calc, abilityId: e.target.value },
                  }))
                }
                className={selectClass}
              >
                {abilities.map((a) => (
                  <option key={a} value={a}>
                    {abilityJa(a)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* 性格 */}
          <Field label="性格">
            <select
              value={draft.calc.natureId}
              onChange={(e) => {
                const n = findNature(e.target.value);
                setDraftAndDirty((d) => ({
                  ...d,
                  nature: n?.nature ?? d.nature,
                  calc: { ...d.calc, natureId: e.target.value },
                }));
              }}
              className={selectClass}
            >
              {NATURES.map((n) => (
                <option key={n.natureId} value={n.natureId}>
                  {natureLabel(n)}
                </option>
              ))}
            </select>
          </Field>

          {/* 実数値プレビュー */}
          <Field label="実数値（自動算出）">
            <div className="grid grid-cols-6 gap-1">
              {STAT_FIELDS.map(({ key, label }) => (
                <div key={key} className="rounded-sm bg-hud-panel px-1 py-1 text-center">
                  <div className="text-[8px] text-hud-faint">{label}</div>
                  <div className="font-mono text-[12px] tabular text-hud-cyan">{previewStats[key]}</div>
                </div>
              ))}
            </div>
          </Field>
        </div>

        {/* 努力値 */}
        <Field label={`努力値（合計 ${evSum}/508）`} warn={evOver ? '508を超えています' : undefined}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STAT_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-hud-faint">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={252}
                  step={4}
                  value={draft.calc.evs[key] ?? 0}
                  onChange={(e) => setEv(key, Math.max(0, Math.min(252, Number(e.target.value) || 0)))}
                  className="w-full border border-hud-line bg-hud-panel px-1 py-1 text-center font-mono text-[12px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
                />
              </label>
            ))}
          </div>
        </Field>

        {/* 技 */}
        <Field label={`技（全習得技から選択・${catalogEntry?.moves.length ?? 0}種）`}>
          <input
            value={moveQuery}
            onChange={(e) => setMoveQuery(e.target.value)}
            placeholder="技名で絞り込み..."
            className="mb-2 w-full border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text placeholder:text-hud-faint focus:border-hud-cyan/50 focus:outline-none"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <select
                key={i}
                value={draft.calc.moveIds?.[i] ?? ''}
                onChange={(e) => {
                  if (e.target.value) setMoveAt(i, e.target.value);
                }}
                className={selectClass}
              >
                <option value="">技{i + 1}未選択</option>
                {draft.calc.moveIds?.[i] && !moveCandidates.includes(draft.calc.moveIds[i]) && (
                  <option value={draft.calc.moveIds[i]}>{moveJa(draft.calc.moveIds[i])}</option>
                )}
                {moveCandidates.map((m) => (
                  <option key={m} value={m}>
                    {moveJa(m)}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-hud-line pt-3">
          {dirty && <span className="font-mono text-[10px] text-hud-amber">未保存の変更があります</span>}
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              setDirty(false);
            }}
            className="rounded-sm border border-hud-cyan/50 bg-hud-cyan/10 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-hud-cyan transition hover:bg-hud-cyan/20"
          >
            この枠を保存
          </button>
        </div>
      </section>
    </div>
  );
}

const selectClass =
  'w-full border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text focus:border-hud-cyan/50 focus:outline-none';

function Field({
  label,
  warn,
  children,
}: {
  label: string;
  warn?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-hud-faint">{label}</span>
        {warn && <span className="text-[10px] text-advantage-mildRisk">{warn}</span>}
      </div>
      {children}
    </div>
  );
}

function ReadonlyValue({ value, note }: { value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text">
      <span>{value}</span>
      {note && <span className="text-[9px] text-hud-faint">{note}</span>}
    </div>
  );
}
