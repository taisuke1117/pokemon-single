'use client';

import { useEffect, useState } from 'react';
import type { BattleState, OpponentSlot, PartyMember } from '@/lib/types';
import type { EvalBreakdown } from '@/lib/engine/gt/eval/compose';

const BREAKDOWN_LABELS: { key: keyof Omit<EvalBreakdown, 'total'>; label: string }[] = [
  { key: 'terminal', label: '決着' },
  { key: 'survival', label: '物量/HP' },
  { key: 'facingThreat', label: '対面' },
  { key: 'safeSwitchIns', label: '引き先' },
  { key: 'hazards', label: '設置物' },
  { key: 'statusBench', label: '状態異常' },
  { key: 'wincon', label: '勝ち筋' },
];

function scoreLabel(total: number): { text: string; className: string } {
  if (total >= 5000) return { text: '勝ち確定', className: 'text-hud-cyan' };
  if (total <= -5000) return { text: '負け確定', className: 'text-advantage-strongRisk' };
  if (total >= 1.5) return { text: '有利', className: 'text-hud-cyan' };
  if (total >= 0.4) return { text: 'やや有利', className: 'text-hud-cyan' };
  if (total <= -1.5) return { text: '不利', className: 'text-advantage-strongRisk' };
  if (total <= -0.4) return { text: 'やや不利', className: 'text-advantage-strongRisk' };
  return { text: '互角', className: 'text-hud-dim' };
}

/** 行列計算を伴わない、現在の盤面の評価値バッジ。盤面が変わるたびに軽量APIで自動更新する。 */
export function CurrentEvalBadge({
  state,
  bench,
  opponents,
}: {
  state: BattleState;
  bench: PartyMember[];
  opponents: OpponentSlot[];
}) {
  const [breakdown, setBreakdown] = useState<EvalBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const payload = JSON.stringify({ state, bench, opponents });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gt-eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setBreakdown(data.breakdown);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  if (error) {
    return <span className="font-mono text-[10px] text-hud-faint">評価値: 計算不可（{error}）</span>;
  }
  if (!breakdown) {
    return <span className="font-mono text-[10px] text-hud-faint">評価値: 計算中…</span>;
  }

  const label = scoreLabel(breakdown.total);
  const displayTotal = Math.abs(breakdown.total) >= 5000 ? (breakdown.total > 0 ? '+∞' : '-∞') : breakdown.total.toFixed(2);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="flex items-center gap-1.5 border border-hud-line bg-hud-panelAlt px-2 py-1 font-mono text-[11px] hover:bg-hud-raised"
      >
        <span className="text-hud-faint">現在の評価値</span>
        <span className={`font-bold tabular ${label.className}`}>{displayTotal}</span>
        <span className={label.className}>{label.text}</span>
      </button>
      {showDetail && (
        <div className="absolute right-0 z-30 mt-1 w-56 border border-hud-line bg-hud-panel p-2 shadow-glow">
          <ul className="space-y-0.5">
            {BREAKDOWN_LABELS.map(({ key, label: l }) => (
              <li key={key} className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-hud-faint">{l}</span>
                <span className={breakdown[key] >= 0 ? 'text-hud-cyan' : 'text-advantage-strongRisk'}>
                  {breakdown[key].toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
