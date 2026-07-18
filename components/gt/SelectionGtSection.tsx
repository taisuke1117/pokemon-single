'use client';

import { useState } from 'react';
import type { SelectionGtRecommendation } from '@/lib/engine/gt/types';
import type { SelectionCandidate } from '@/lib/engine/gt/types';
import type { OpponentSlot, PartyMember } from '@/lib/types';
import type { ManualSelection } from '../SelectionEditor';

type Status = 'idle' | 'loading' | 'error';

/**
 * 選出補佐（ゲーム理論版）。対戦中エンジンと同じ利得行列の考え方を「6匹から3匹選ぶ」
 * 選出レベルに適用する。既存のヒューリスティック選出(SelectionRecommendation)は
 * そのまま残し、こちらは「詳細分析」として併記する。
 */
export function SelectionGtSection({
  party,
  opponents,
  onApply,
}: {
  party: PartyMember[];
  opponents: OpponentSlot[];
  onApply: (selection: ManualSelection) => void;
}) {
  const [rec, setRec] = useState<SelectionGtRecommendation | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/gt-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party, opponents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRec(data as SelectionGtRecommendation);
      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  function apply(candidate: SelectionCandidate) {
    onApply({ memberIds: candidate.memberIds, leadId: candidate.leadId });
  }

  const nashTop = rec
    ? rec.selfCandidates
        .map((c, i) => ({ candidate: c, p: rec.nash.selfMix[i] ?? 0 }))
        .filter((x) => x.p > 0.01)
        .sort((a, b) => b.p - a.p)
        .slice(0, 5)
    : [];
  const maximinCandidate = rec?.selfCandidates[rec.maximin.selfActionIndex];
  const bestResponseCandidate = rec?.bestResponse ? rec.selfCandidates[rec.bestResponse.selfActionIndex] : undefined;
  const topOppCandidates = rec
    ? rec.oppCandidates
        .map((c, i) => ({ candidate: c, w: rec.oppWeights[i] ?? 0 }))
        .sort((a, b) => b.w - a.w)
        .slice(0, 3)
    : [];

  return (
    <section className="border border-hud-line bg-hud-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hud-line px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-hud-text">
            詳細分析：選出のゲーム理論
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-widest text-hud-faint">
            6→3の選出行列 × ナッシュ均衡
          </span>
        </div>
        <button
          type="button"
          onClick={handleCompute}
          disabled={status === 'loading'}
          className="rounded-sm border border-hud-cyan/50 bg-hud-cyan/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-hud-cyan transition hover:bg-hud-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'loading' ? '計算中…' : rec ? '再計算' : '選出行列を計算'}
        </button>
      </header>

      <div className="p-3">
        {status === 'loading' && (
          <p className="font-mono text-[11px] text-hud-cyan">
            自分の6匹から3匹の全組み合わせ×相手の想定選出パターンを評価中…
          </p>
        )}
        {error && <p className="font-mono text-[11px] text-advantage-mildRisk">エラー: {error}</p>}
        {!rec && status === 'idle' && !error && (
          <p className="text-[11px] text-hud-faint">
            「選出行列を計算」を押すと、自分の6匹から3匹を選ぶ全パターンと、相手の判明済み種族から想定される選出パターンの利得行列を作り、読み合いの最適解（ナッシュ均衡）・安全策（マキシミン）・相手の傾向を突く選出（最適応答）を提示します。
          </p>
        )}
        {rec && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <CandidateGroup
                title="ナッシュ均衡（読み合いの最適混合）"
                entries={nashTop.map((x) => ({ candidate: x.candidate, sub: `採用率 ${(x.p * 100).toFixed(0)}%` }))}
                onApply={apply}
                accent="cyan"
              />
              <div className="flex flex-col gap-2">
                {maximinCandidate && (
                  <CandidateGroup
                    title="安全策（マキシミン）"
                    entries={[{ candidate: maximinCandidate, sub: `最悪ケース評価値 ${rec.maximin.value.toFixed(2)}` }]}
                    onApply={apply}
                    accent="amber"
                  />
                )}
                {bestResponseCandidate && rec.bestResponse && (
                  <CandidateGroup
                    title="最適応答（相手の傾向を突く）"
                    entries={[{ candidate: bestResponseCandidate, sub: rec.bestResponse.note }]}
                    onApply={apply}
                    accent="amber"
                  />
                )}
              </div>
            </div>

            <div className="border-t border-hud-line pt-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-hud-faint">
                相手の想定選出トップ{topOppCandidates.length}
              </span>
              <ul className="mt-1 space-y-0.5">
                {topOppCandidates.map(({ candidate, w }) => (
                  <li key={candidate.label} className="flex items-center justify-between text-[11px] text-hud-text">
                    <span>{candidate.label}</span>
                    <span className="font-mono text-[10px] text-hud-dim">{(w * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="space-y-1 border-t border-hud-line pt-2">
              {rec.notes.map((n, i) => (
                <li key={i} className="flex gap-1.5 text-[10px] text-hud-faint">
                  <span className="mt-0.5 text-hud-cyan">▸</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function CandidateGroup({
  title,
  entries,
  onApply,
  accent,
}: {
  title: string;
  entries: { candidate: SelectionCandidate; sub: string }[];
  onApply: (c: SelectionCandidate) => void;
  accent: 'cyan' | 'amber';
}) {
  const color = accent === 'cyan' ? 'text-hud-cyan' : 'text-hud-amber';
  return (
    <div className="border border-hud-line bg-hud-panelAlt p-2.5">
      <span className={`font-mono text-[9px] font-bold uppercase tracking-widest ${color}`}>{title}</span>
      <ul className="mt-1.5 space-y-1.5">
        {entries.map(({ candidate, sub }) => (
          <li key={candidate.label} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[12px] text-hud-text">{candidate.label}</div>
              <div className="font-mono text-[9px] text-hud-dim">{sub}</div>
            </div>
            <button
              type="button"
              onClick={() => onApply(candidate)}
              className="shrink-0 border border-hud-cyan/50 bg-hud-cyan/10 px-2 py-1 font-mono text-[9px] uppercase text-hud-cyan hover:bg-hud-cyan/20"
            >
              採用
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
