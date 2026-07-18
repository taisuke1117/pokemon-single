'use client';

import { useState } from 'react';
import type { OpponentSlot } from '@/lib/types';
import { OpponentEditor } from './OpponentEditor';
import { TypeBadge } from './TypeBadge';
import { PokemonSprite } from './PokemonSprite';

export function OpponentInput({
  slots,
  onChange,
}: {
  slots: OpponentSlot[];
  onChange: (slots: OpponentSlot[]) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  return (
    <section className="border border-hud-line bg-hud-panel">
      <header className="flex items-center justify-between border-b border-hud-line px-3 py-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-hud-text">
          相手パーティ入力
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-hud-dim">
            {slots.filter((s) => s.resolvedName).length}/6 判明
          </span>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="rounded-sm border border-hud-cyan/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-hud-cyan hover:bg-hud-cyan/10"
          >
            編集
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-px bg-hud-line sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot, i) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => {
              setInitialIndex(i);
              setEditorOpen(true);
            }}
            className="bg-hud-panel px-3 py-2.5 text-left transition hover:bg-hud-panelAlt"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-hud-faint">P{i + 1}</span>
              {slot.resolvedName && (
                <PokemonSprite species={slot.species} name={slot.resolvedName} types={slot.types} size="sm" />
              )}
              <span className="truncate text-[13px] font-semibold text-hud-text">
                {slot.resolvedName ?? '未入力'}
              </span>
            </div>

            {slot.resolvedName ? (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {slot.types?.map((t) => <TypeBadge key={t} type={t} size="xs" />)}
                  </div>
                  <span className="font-mono text-[10px] tabular text-hud-cyan">
                    {slot.rank ? `${slot.rank}位` : '順位不明'}
                  </span>
                </div>
                {slot.moveUsage && (
                  <div className="flex flex-wrap gap-1 border-t border-hud-line pt-1.5">
                    {slot.moveUsage.slice(0, 5).map((m) => (
                      <span
                        key={m.moveId}
                        className="rounded-sm bg-hud-panelAlt px-1 py-0.5 font-mono text-[9px] text-hud-dim"
                      >
                        {m.move} <span className="text-hud-faint">{Math.round(m.usage * 100)}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1.5 text-[10px] text-hud-faint">未入力 — 型は環境データから推定</div>
            )}
          </button>
        ))}
      </div>

      {editorOpen && (
        <OpponentEditor slots={slots} initialIndex={initialIndex} onChange={onChange} onClose={() => setEditorOpen(false)} />
      )}
    </section>
  );
}
