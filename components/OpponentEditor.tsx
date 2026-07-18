'use client';

import { useMemo, useState } from 'react';
import type { OpponentSlot } from '@/lib/types';
import { searchFullCatalog, type SpeciesCatalogEntry } from '@/lib/data/species-catalog';
import { findEnvEntry } from '@/lib/data/env-season-m4';
import { TypeBadge } from './TypeBadge';
import { PokemonSprite } from './PokemonSprite';

/**
 * 相手6枠の編集モーダル。自分のパーティ登録(PartyEditor)と同じ構造
 * （上部にスロットタブ、左に検索ゾーン、選ぶと即座にその枠へ反映）にすることで、
 * 「一度確定した枠は再検索できない」「絶対配置のドロップダウンが下のUIと重なる」
 * という旧UIの問題を解消する。
 */
export function OpponentEditor({
  slots,
  initialIndex,
  onChange,
  onClose,
}: {
  slots: OpponentSlot[];
  initialIndex: number;
  onChange: (slots: OpponentSlot[]) => void;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const active = slots[activeIndex];

  function pick(entry: SpeciesCatalogEntry) {
    const envEntry = findEnvEntry(entry.name);
    const next = slots.map((s, i) =>
      i === activeIndex
        ? {
            ...s,
            query: entry.name,
            resolvedName: entry.name,
            species: entry.species,
            types: entry.types,
            rank: entry.rank,
            spreads: envEntry?.spreads,
            moveUsage: envEntry?.moveUsage,
            confirmed: false,
          }
        : s,
    );
    onChange(next);
  }

  function clearSlot() {
    const next = slots.map((s, i) =>
      i === activeIndex
        ? { id: s.id, query: '', resolvedName: undefined, species: undefined, types: undefined, rank: undefined, spreads: undefined, moveUsage: undefined, confirmed: false }
        : s,
    );
    onChange(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-hud-line bg-hud-panel shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hud-line px-4 py-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-hud-text">
            相手パーティ編集
          </h2>
          <button type="button" onClick={onClose} className="font-mono text-xs text-hud-dim hover:text-hud-text">
            閉じる ✕
          </button>
        </header>

        <div className="flex gap-px overflow-x-auto bg-hud-line">
          {slots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`flex min-w-[84px] flex-1 flex-col items-center gap-1 bg-hud-panel px-2 py-2 transition ${
                i === activeIndex ? 'bg-hud-raised ring-1 ring-inset ring-hud-cyan' : 'hover:bg-hud-panelAlt'
              }`}
            >
              {s.resolvedName ? (
                <PokemonSprite species={s.species} name={s.resolvedName} size="sm" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-hud-faint font-display text-xs text-hud-faint">
                  ?
                </span>
              )}
              <span className="w-full truncate text-center text-[10px] text-hud-text">{s.resolvedName ?? '未入力'}</span>
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4">
          {active && (
            <SlotEditor key={active.id} slot={active} onPick={pick} onClear={clearSlot} />
          )}
        </div>
      </div>
    </div>
  );
}

function SlotEditor({
  slot,
  onPick,
  onClear,
}: {
  slot: OpponentSlot;
  onPick: (entry: SpeciesCatalogEntry) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchFullCatalog(query, 20), [query]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      {/* 検索ゾーン */}
      <section className="border border-hud-line bg-hud-panelAlt">
        <header className="border-b border-hud-line px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hud-faint">
            ポケモン検索（使用率データありを優先表示）
          </span>
        </header>
        <div className="p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ポケモン名で検索..."
            autoFocus
            className="mb-2 w-full border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text placeholder:text-hud-faint focus:border-hud-cyan/50 focus:outline-none"
          />
          <ul className="max-h-[420px] space-y-0.5 overflow-y-auto">
            {results.map((e) => (
              <li key={e.species}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-hud-cyan/10 ${
                    e.species === slot.species ? 'bg-hud-cyan/10 ring-1 ring-inset ring-hud-cyan/40' : ''
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
            {results.length === 0 && (
              <li className="px-2 py-3 text-center text-[11px] text-hud-faint">該当するポケモンがいません</li>
            )}
          </ul>
        </div>
      </section>

      {/* 現在の割当内容 */}
      <section className="flex flex-col gap-3">
        <div className="border border-hud-line bg-hud-panelAlt p-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hud-faint">この枠の現在の内容</span>
          {slot.resolvedName ? (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <PokemonSprite species={slot.species} name={slot.resolvedName} types={slot.types} size="md" />
                <div>
                  <div className="text-[13px] font-semibold text-hud-text">{slot.resolvedName}</div>
                  <div className="mt-0.5 flex gap-1">
                    {slot.types?.map((t) => <TypeBadge key={t} type={t} size="xs" />)}
                  </div>
                </div>
              </div>
              <div className="font-mono text-[10px] text-hud-dim">
                順位: {slot.rank ? `${slot.rank}位` : '不明'}
              </div>
              {slot.moveUsage && (
                <div className="flex flex-wrap gap-1 border-t border-hud-line pt-2">
                  {slot.moveUsage.slice(0, 6).map((m) => (
                    <span key={m.moveId} className="rounded-sm bg-hud-panel px-1 py-0.5 font-mono text-[9px] text-hud-dim">
                      {m.move} <span className="text-hud-faint">{Math.round(m.usage * 100)}%</span>
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onClear}
                className="mt-1 border border-advantage-strongRisk/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-advantage-strongRisk hover:bg-advantage-strongRisk/10"
              >
                この枠をクリア
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-hud-faint">未入力です。左の検索から選択してください。</p>
          )}
        </div>
      </section>
    </div>
  );
}
