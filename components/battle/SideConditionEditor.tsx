'use client';

import type { SideConditions } from '@/lib/types';

export function SideConditionEditor({
  label,
  side,
  onChange,
}: {
  label: string;
  side: SideConditions;
  onChange: (patch: Partial<SideConditions>) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 border border-hud-line bg-hud-panel p-2.5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-hud-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip label="ステルスロック" checked={side.isSR} onChange={(v) => onChange({ isSR: v })} />
        <Chip label="リフレクター" checked={side.isReflect} onChange={(v) => onChange({ isReflect: v })} />
        <Chip label="ひかりのかべ" checked={side.isLightScreen} onChange={(v) => onChange({ isLightScreen: v })} />
        <Chip label="オーロラベール" checked={side.isAuroraVeil} onChange={(v) => onChange({ isAuroraVeil: v })} />
        <Chip label="おいかぜ" checked={side.isTailwind} onChange={(v) => onChange({ isTailwind: v })} />
        <div className="flex items-center gap-1 border border-hud-line px-1.5 py-1">
          <span className="font-mono text-[9px] text-hud-faint">まきびし</span>
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ spikes: n })}
              className={`h-5 w-5 font-mono text-[10px] transition ${
                side.spikes === n ? 'bg-hud-cyan/20 text-hud-cyan' : 'text-hud-faint hover:bg-hud-panelAlt'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`border px-1.5 py-1 font-mono text-[9px] uppercase tracking-wide transition ${
        checked ? 'border-hud-cyan/60 bg-hud-cyan/15 text-hud-cyan' : 'border-hud-line text-hud-faint hover:bg-hud-panelAlt'
      }`}
    >
      {label}
    </button>
  );
}
