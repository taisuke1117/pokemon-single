'use client';

import { useState } from 'react';
import type { PayoffMatrix } from '@/lib/engine/gt/types';

/** 評価値(自分視点)を -100..100 相当に正規化して5段階の色に写像する。 */
function cellClass(v: number): string {
  // 終端(±10000)や大きな勝ち筋(±4)を考慮し、tanh的に圧縮して色段階を決める
  const scaled = Math.max(-1, Math.min(1, v / 2)); // ±2で飽和
  if (scaled >= 0.5) return 'bg-advantage-strong/30 border-advantage-strong text-blue-100';
  if (scaled >= 0.15) return 'bg-advantage-mild/20 border-advantage-mild/70 text-blue-100';
  if (scaled <= -0.5) return 'bg-advantage-strongRisk/35 border-advantage-strongRisk text-red-100';
  if (scaled <= -0.15) return 'bg-advantage-mildRisk/20 border-advantage-mildRisk/70 text-red-100';
  return 'bg-hud-panelAlt border-hud-line text-hud-dim';
}

export function PayoffMatrixHeatmap({
  payoff,
  nashSelfMix,
  nashOppMix,
}: {
  payoff: PayoffMatrix;
  nashSelfMix: number[];
  nashOppMix: number[];
}) {
  const [sel, setSel] = useState<{ i: number; j: number } | null>(null);
  const selValue = sel ? payoff.matrix[sel.i]?.[sel.j] : undefined;

  return (
    <section className="flex flex-col border border-hud-line bg-hud-panel">
      <header className="flex items-center justify-between border-b border-hud-line px-3 py-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-hud-text">利得行列</h3>
        <span className="font-mono text-[9px] uppercase tracking-widest text-hud-faint">行=自分の手 / 列=相手の手</span>
      </header>

      <div className="overflow-auto">
        <table className="border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[120px] border-b border-r border-hud-line bg-hud-panel px-2 py-1.5" />
              {payoff.oppActions.map((a, j) => (
                <th key={j} className="min-w-[64px] border-b border-r border-hud-line bg-hud-panel px-1.5 py-1.5 text-center align-bottom">
                  <div className="truncate text-[10px] font-semibold text-hud-text" title={a.label}>{a.label}</div>
                  <div className="font-mono text-[8px] tabular text-hud-cyan">{(nashOppMix[j] * 100).toFixed(0)}%</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payoff.selfActions.map((sa, i) => (
              <tr key={i}>
                <th className="sticky left-0 z-10 min-w-[120px] border-b border-r border-hud-line bg-hud-panel px-2 py-1 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] font-semibold text-hud-text" title={sa.label}>{sa.label}</span>
                    <span className="font-mono text-[8px] tabular text-hud-amber">{(nashSelfMix[i] * 100).toFixed(0)}%</span>
                  </div>
                </th>
                {payoff.oppActions.map((_, j) => {
                  const v = payoff.matrix[i][j];
                  const isSel = sel?.i === i && sel?.j === j;
                  return (
                    <td key={j} className="border-b border-r border-hud-line p-0">
                      <button
                        type="button"
                        onClick={() => setSel({ i, j })}
                        className={`w-full px-1 py-1.5 text-center font-mono text-[10px] tabular transition hover:brightness-125 ${cellClass(v)} ${isSel ? 'ring-1 ring-inset ring-hud-cyan' : ''}`}
                      >
                        {Math.abs(v) >= 1000 ? (v > 0 ? '勝' : '負') : v.toFixed(1)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-hud-line px-3 py-2 text-[11px] text-hud-dim">
        {sel && selValue !== undefined ? (
          <span>
            <span className="text-hud-text">{payoff.selfActions[sel.i].label}</span> ×{' '}
            <span className="text-hud-text">{payoff.oppActions[sel.j].label}</span> →{' '}
            <span className={`font-mono font-semibold ${selValue >= 0 ? 'text-hud-cyan' : 'text-advantage-mildRisk'}`}>
              評価値 {selValue.toFixed(2)}
            </span>
            <span className="text-hud-faint">（自分視点・プラスで有利）</span>
          </span>
        ) : (
          <span className="text-hud-faint">セルをクリックすると、その手の組み合わせの評価値を表示します</span>
        )}
      </div>
    </section>
  );
}
