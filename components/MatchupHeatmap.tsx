'use client';

import { useState } from 'react';
import type { MatchupCell, OpponentSlot, PartyMember, Verdict } from '@/lib/types';
import { PokemonSprite } from './PokemonSprite';

const VERDICT_STYLE: Record<Verdict, string> = {
  strong: 'bg-advantage-strong/30 border-advantage-strong text-blue-100',
  mild: 'bg-advantage-mild/20 border-advantage-mild/70 text-blue-100',
  neutral: 'bg-hud-panelAlt border-hud-line text-hud-dim',
  mildRisk: 'bg-advantage-mildRisk/20 border-advantage-mildRisk/70 text-red-100',
  strongRisk: 'bg-advantage-strongRisk/35 border-advantage-strongRisk text-red-100',
};

const SPEED_ICON: Record<MatchupCell['speed'], { icon: string; className: string }> = {
  win: { icon: '▲', className: 'text-hud-cyan' },
  lose: { icon: '▼', className: 'text-hud-faint' },
  tie50: { icon: '◆', className: 'text-hud-amber' },
};

export function MatchupHeatmap({
  party,
  opponents,
  matrix,
}: {
  party: PartyMember[];
  opponents: OpponentSlot[];
  matrix: Record<string, Record<string, MatchupCell>>;
}) {
  const [selected, setSelected] = useState<{ partyId: string; oppId: string } | null>(null);

  const selCell = selected ? matrix[selected.partyId]?.[selected.oppId] : null;
  const selParty = selected ? party.find((p) => p.id === selected.partyId) : null;
  const selOpp = selected ? opponents.find((o) => o.id === selected.oppId) : null;

  return (
    <section className="flex h-full flex-col border border-hud-line bg-hud-panel">
      <header className="flex items-center justify-between border-b border-hud-line px-3 py-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-hud-text">
          相性マトリクス
        </h2>
        <Legend />
      </header>

      <div className="overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[110px] border-b border-r border-hud-line bg-hud-panel px-2 py-1.5" />
              {opponents.map((o) => (
                <th
                  key={o.id}
                  className="sticky top-0 z-10 min-w-[92px] border-b border-r border-hud-line bg-hud-panel px-2 py-1.5 text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    {o.resolvedName && <PokemonSprite species={o.species} name={o.resolvedName} types={o.types} size="sm" />}
                    <div className="truncate text-[11px] font-semibold text-hud-text">
                      {o.resolvedName ?? '未入力'}
                    </div>
                  </div>
                  <div className="font-mono text-[9px] tabular text-hud-faint">
                    {o.rank ? `${o.rank}位` : '--'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {party.map((p) => (
              <tr key={p.id}>
                <th className="sticky left-0 z-10 min-w-[110px] border-b border-r border-hud-line bg-hud-panel px-2 py-1.5 text-left">
                  <div className="flex items-center gap-1.5">
                    <PokemonSprite species={p.calc.species} name={p.name} types={p.types} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-hud-text">{p.name}</div>
                      <div className="font-mono text-[9px] tabular text-hud-faint">S{p.stats.s}</div>
                    </div>
                  </div>
                </th>
                {opponents.map((o) => {
                  const cell = matrix[p.id]?.[o.id];
                  if (!cell) {
                    return (
                      <td
                        key={o.id}
                        className="border-b border-r border-hud-line bg-hud-panelAlt px-2 py-1.5 text-center font-mono text-[10px] text-hud-faint"
                      >
                        --
                      </td>
                    );
                  }
                  const isSel = selected?.partyId === p.id && selected?.oppId === o.id;
                  const speed = SPEED_ICON[cell.speed];
                  return (
                    <td key={o.id} className="border-b border-r border-hud-line p-0">
                      <button
                        type="button"
                        onClick={() => setSelected({ partyId: p.id, oppId: o.id })}
                        className={`flex w-full flex-col items-center gap-0.5 border-l-2 px-1.5 py-1.5 transition-transform hover:scale-[1.03] hover:z-10 hover:shadow-glow ${
                          VERDICT_STYLE[cell.verdict]
                        } ${isSel ? 'ring-1 ring-hud-cyan ring-inset' : ''}`}
                      >
                        <div className="flex w-full items-center justify-between font-mono text-[11px] font-semibold tabular">
                          <span>{cell.atkRange}</span>
                          <span className={speed.className}>{speed.icon}</span>
                        </div>
                        <div className="w-full truncate text-center font-mono text-[9px] tabular opacity-80">
                          {cell.atkKo}
                        </div>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-hud-line px-3 py-2.5">
        {selCell && selParty && selOpp ? (
          <div className="animate-rise grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={`${selParty.name} → ${selOpp.resolvedName}`} value={selCell.atkRange} sub={selCell.atkKo} accent="cyan" />
            <Stat label={`${selOpp.resolvedName} → ${selParty.name}`} value={selCell.defRange} sub={selCell.defKo} accent="amber" />
            <Stat
              label="速度関係"
              value={selCell.speed === 'win' ? '先手確定' : selCell.speed === 'lose' ? '後手確定' : '同速50%'}
              sub={`実数値 S${selParty.stats.s}`}
              accent={selCell.speed === 'win' ? 'cyan' : selCell.speed === 'lose' ? 'faint' : 'amber'}
            />
            <Stat label="所見" value={cellVerdictLabel(selCell.verdict)} sub={selCell.note ?? '--'} accent={verdictAccent(selCell.verdict)} />
          </div>
        ) : (
          <p className="text-[11px] text-hud-faint">
            セルをクリックすると双方向のダメージ詳細をここに表示します
          </p>
        )}
      </div>
    </section>
  );
}

function cellVerdictLabel(v: Verdict) {
  return { strong: '有利', mild: 'やや有利', neutral: '五分', mildRisk: 'やや不利', strongRisk: '不利' }[v];
}
function verdictAccent(v: Verdict): 'cyan' | 'amber' | 'faint' {
  if (v === 'strong' || v === 'mild') return 'cyan';
  if (v === 'neutral') return 'faint';
  return 'amber';
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: 'cyan' | 'amber' | 'faint';
}) {
  const color = { cyan: 'text-hud-cyan', amber: 'text-hud-amber', faint: 'text-hud-dim' }[accent];
  return (
    <div>
      <div className="truncate text-[10px] uppercase tracking-wide text-hud-faint">{label}</div>
      <div className={`font-mono text-base font-semibold tabular ${color}`}>{value}</div>
      <div className="truncate text-[10px] text-hud-dim">{sub}</div>
    </div>
  );
}

function Legend() {
  const items: { v: Verdict; label: string }[] = [
    { v: 'strong', label: '有利' },
    { v: 'mild', label: 'やや有利' },
    { v: 'neutral', label: '五分' },
    { v: 'mildRisk', label: 'やや不利' },
    { v: 'strongRisk', label: '不利' },
  ];
  return (
    <div className="hidden items-center gap-2 sm:flex">
      {items.map(({ v, label }) => (
        <div key={v} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-sm border ${VERDICT_STYLE[v]}`} />
          <span className="text-[9px] text-hud-faint">{label}</span>
        </div>
      ))}
    </div>
  );
}
