'use client';

import type { GtRecommendation } from '@/lib/engine/gt/types';

export function ActionRecommendationPanel({ rec }: { rec: GtRecommendation }) {
  const { payoff, nash, maximin, bestResponse, recommendedMode } = rec;

  // ナッシュ混合戦略のうち確率が立っている手を降順に
  const nashMix = payoff.selfActions
    .map((a, i) => ({ label: a.label, p: nash.selfMix[i] }))
    .filter((x) => x.p > 0.01)
    .sort((a, b) => b.p - a.p);

  return (
    <section className="flex flex-col gap-3 border border-hud-line bg-hud-panel p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">推奨手</h3>
        <span className="font-mono text-[9px] uppercase tracking-wide text-hud-cyan">
          推奨: {recommendedMode === 'nash' ? 'ナッシュ均衡' : '最適応答'}
        </span>
      </div>

      {/* ナッシュ均衡（混合戦略） */}
      <div className={`border-l-2 pl-2 ${recommendedMode === 'nash' ? 'border-hud-cyan' : 'border-hud-line'}`}>
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-hud-text">ナッシュ均衡（読み合いの最適解）</span>
          {recommendedMode === 'nash' && <span className="font-mono text-[8px] text-hud-cyan">◀ 推奨</span>}
        </div>
        <ul className="space-y-0.5">
          {nashMix.map((x) => (
            <li key={x.label} className="flex items-center justify-between text-[12px]">
              <span className="text-hud-text">{x.label}</span>
              <span className="font-mono tabular text-hud-cyan">{(x.p * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
        <div className="mt-1 font-mono text-[9px] text-hud-faint">
          ゲーム値 {nash.value.toFixed(2)}（この局面の均衡での期待有利さ）
        </div>
      </div>

      {/* マキシミン（安全策） */}
      <div className="border-l-2 border-hud-line pl-2">
        <div className="mb-0.5 text-[11px] font-semibold text-hud-text">マキシミン（安全策）</div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-hud-text">{payoff.selfActions[maximin.selfActionIndex]?.label}</span>
          <span className="font-mono tabular text-hud-amber">最悪 {maximin.value.toFixed(2)}</span>
        </div>
        <div className="mt-0.5 text-[9px] text-hud-faint">読みが外れても最悪ケースが最もマシな手</div>
      </div>

      {/* 最適応答（相手が偏っている場合） */}
      {bestResponse && (
        <div className={`border-l-2 pl-2 ${recommendedMode === 'bestResponse' ? 'border-hud-cyan' : 'border-hud-line'}`}>
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-hud-text">最適応答（相手の傾向を突く）</span>
            {recommendedMode === 'bestResponse' && <span className="font-mono text-[8px] text-hud-cyan">◀ 推奨</span>}
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-hud-text">{payoff.selfActions[bestResponse.selfActionIndex]?.label}</span>
            <span className="font-mono tabular text-hud-cyan">{bestResponse.value.toFixed(2)}</span>
          </div>
          <div className="mt-0.5 text-[9px] text-hud-faint">{bestResponse.note}</div>
        </div>
      )}

      {rec.notes.length > 0 && (
        <ul className="border-t border-hud-line pt-2">
          {rec.notes.map((n, i) => (
            <li key={i} className="text-[9px] leading-snug text-hud-faint">※ {n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
