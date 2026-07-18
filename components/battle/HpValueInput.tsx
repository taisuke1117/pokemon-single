'use client';

import { useState } from 'react';

/**
 * HP入力。maxHpが分かる場合（＝自分のポケモン。実際の対戦画面に実数値が表示されるため）は
 * 実数値入力にも切り替えられる。maxHpが分からない場合（＝相手。ゲーム内でも%表示しか
 * 見えないため）は%入力のみになる。内部的には常に%へ変換してonChangePercentへ渡す
 * （エンジン全体がcurrentHpPercentで統一されているため、保存形式は変えない）。
 */
export function HpValueInput({
  percent,
  onChangePercent,
  maxHp,
  className,
  testId,
}: {
  percent: number;
  onChangePercent: (pct: number) => void;
  /** 分かっている場合のみ渡す。渡すと実数値入力に切り替え可能になる。 */
  maxHp?: number;
  className?: string;
  testId?: string;
}) {
  const [mode, setMode] = useState<'percent' | 'absolute'>(maxHp ? 'absolute' : 'percent');
  const useAbsolute = mode === 'absolute' && maxHp !== undefined;
  const displayValue = useAbsolute ? Math.round((percent / 100) * maxHp) : percent;

  function handleChange(raw: number) {
    if (useAbsolute && maxHp) {
      const clamped = Math.max(0, Math.min(maxHp, raw));
      onChangePercent(Math.round((clamped / maxHp) * 100));
    } else {
      onChangePercent(Math.max(0, Math.min(100, raw)));
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        data-testid={testId}
        min={0}
        max={useAbsolute ? maxHp : 100}
        value={displayValue}
        onChange={(e) => handleChange(Number(e.target.value) || 0)}
        className={className}
      />
      {maxHp !== undefined && (
        <button
          type="button"
          onClick={() => setMode(useAbsolute ? 'percent' : 'absolute')}
          title={useAbsolute ? '%入力に切り替え' : '実数値入力に切り替え'}
          className="shrink-0 whitespace-nowrap border border-hud-line px-1.5 py-1 font-mono text-[10px] text-hud-dim hover:bg-hud-panelAlt"
        >
          {useAbsolute ? `/${maxHp}` : '%'}
        </button>
      )}
    </div>
  );
}
