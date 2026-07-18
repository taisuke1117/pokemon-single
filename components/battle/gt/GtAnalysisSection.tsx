'use client';

import { useState } from 'react';
import type { GtRecommendation } from '@/lib/engine/gt/types';
import type { BattleState, OpponentSlot, PartyMember } from '@/lib/types';
import { PayoffMatrixHeatmap } from './PayoffMatrixHeatmap';
import { ActionRecommendationPanel } from './ActionRecommendationPanel';

type Status = 'idle' | 'loading' | 'error';

export function GtAnalysisSection({
  state,
  bench,
  opponents,
}: {
  state: BattleState;
  bench: PartyMember[];
  opponents: OpponentSlot[];
}) {
  const [rec, setRec] = useState<GtRecommendation | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/gt-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, bench, opponents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRec(data as GtRecommendation);
      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <section className="border border-hud-line bg-hud-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hud-line px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-hud-text">
            詳細分析：ゲーム理論
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-widest text-hud-faint">
            利得行列 × ナッシュ均衡
          </span>
        </div>
        <button
          type="button"
          onClick={handleCompute}
          disabled={status === 'loading'}
          className="rounded-sm border border-hud-cyan/50 bg-hud-cyan/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-hud-cyan transition hover:bg-hud-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'loading' ? '計算中…（数秒）' : rec ? '再計算' : '行列を計算'}
        </button>
      </header>

      <div className="p-3">
        {status === 'loading' && (
          <p className="font-mono text-[11px] text-hud-cyan">
            全手ペアをシミュレーションで解決中… 相手の型はサンプリングで平均しています。
          </p>
        )}
        {error && <p className="font-mono text-[11px] text-advantage-mildRisk">エラー: {error}</p>}
        {!rec && status === 'idle' && !error && (
          <p className="text-[11px] text-hud-faint">
            「行列を計算」を押すと、現在の盤面から自分の手×相手の手の利得行列を作り、読み合いの最適解（ナッシュ均衡）・安全策（マキシミン）・相手の傾向を突く手（最適応答）を提示します。計算には数秒かかります。
          </p>
        )}
        {rec && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
            <PayoffMatrixHeatmap payoff={rec.payoff} nashSelfMix={rec.nash.selfMix} nashOppMix={rec.nash.oppMix} />
            <ActionRecommendationPanel rec={rec} />
          </div>
        )}
      </div>
    </section>
  );
}
