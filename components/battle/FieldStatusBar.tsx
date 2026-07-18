'use client';

import type { BattleFieldState } from '@/lib/types';

const WEATHER_OPTIONS: { value: BattleFieldState['weather'] | ''; label: string }[] = [
  { value: '', label: '天候なし' },
  { value: 'Sun', label: 'はれ' },
  { value: 'Rain', label: 'あめ' },
  { value: 'Sand', label: 'すなあらし' },
  { value: 'Snow', label: 'ゆき' },
];

const TERRAIN_OPTIONS: { value: BattleFieldState['terrain'] | ''; label: string }[] = [
  { value: '', label: 'フィールドなし' },
  { value: 'Electric', label: 'エレキフィールド' },
  { value: 'Grassy', label: 'グラスフィールド' },
  { value: 'Psychic', label: 'サイコフィールド' },
  { value: 'Misty', label: 'ミストフィールド' },
];

export function FieldStatusBar({
  turn,
  field,
  onChange,
  onEndBattle,
}: {
  turn: number;
  field: BattleFieldState;
  onChange: (patch: Partial<Pick<BattleFieldState, 'weather' | 'terrain' | 'isTrickRoom'>>) => void;
  onEndBattle: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border border-hud-line bg-hud-panel px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="font-display text-sm font-bold uppercase tracking-wide text-hud-text">Battle Ops</span>
        <span className="font-mono text-[11px] text-hud-dim">ターン {turn}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={field.weather ?? ''}
          onChange={(e) => onChange({ weather: (e.target.value || undefined) as BattleFieldState['weather'] })}
          className="border border-hud-line bg-hud-panelAlt px-2 py-1 text-[11px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
        >
          {WEATHER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={field.terrain ?? ''}
          onChange={(e) => onChange({ terrain: (e.target.value || undefined) as BattleFieldState['terrain'] })}
          className="border border-hud-line bg-hud-panelAlt px-2 py-1 text-[11px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
        >
          {TERRAIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onChange({ isTrickRoom: !field.isTrickRoom })}
          className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition ${
            field.isTrickRoom
              ? 'border-hud-cyan/60 bg-hud-cyan/15 text-hud-cyan'
              : 'border-hud-line text-hud-faint hover:bg-hud-panelAlt'
          }`}
        >
          トリックルーム
        </button>

        <button
          type="button"
          onClick={onEndBattle}
          className="border border-advantage-strongRisk/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-advantage-strongRisk hover:bg-advantage-strongRisk/10"
        >
          対戦終了
        </button>
      </div>
    </header>
  );
}
