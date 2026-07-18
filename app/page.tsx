'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPanel } from '@/components/PartyPanel';
import { OpponentInput } from '@/components/OpponentInput';
import { MatchupHeatmap } from '@/components/MatchupHeatmap';
import { SelectionRecommendation } from '@/components/SelectionRecommendation';
import { PartyEditor } from '@/components/PartyEditor';
import { SelectionEditor, type ManualSelection } from '@/components/SelectionEditor';
import { OpponentLeadPicker } from '@/components/OpponentLeadPicker';
import { SelectionGtSection } from '@/components/gt/SelectionGtSection';
import { usePartyMembers } from '@/store/party-store';
import { useBattleStore } from '@/store/battle-store';
import { findEnvEntry } from '@/lib/data/env-season-m4';
import { buildMatchupMatrix } from '@/lib/engine/matchup';
import { rankSelections, describeMemberPick } from '@/lib/engine/rank';
import type { OpponentSlot, SelectionPick } from '@/lib/types';

function toOpponentSlot(id: string, name: string, confirmed = false): OpponentSlot {
  const entry = findEnvEntry(name);
  if (!entry) return { id, query: name };
  return {
    id,
    query: name,
    resolvedName: entry.name,
    species: entry.species,
    types: entry.types,
    rank: entry.rank,
    spreads: entry.spreads,
    moveUsage: entry.moveUsage,
    confirmed,
  };
}

const INITIAL_OPPONENTS: OpponentSlot[] = [
  toOpponentSlot('o1', 'ミミッキュ', true),
  toOpponentSlot('o2', 'メタグロス'),
  toOpponentSlot('o3', 'ハラバリー'),
  toOpponentSlot('o4', 'カバルドン', true),
  { id: 'o5', query: '' },
  { id: 'o6', query: '' },
];

type ExplainStatus = 'idle' | 'loading' | 'error';

export default function Home() {
  const router = useRouter();
  const party = usePartyMembers();
  const startBattle = useBattleStore((s) => s.startBattle);
  const [opponents, setOpponents] = useState<OpponentSlot[]>(INITIAL_OPPONENTS);
  const [editorOpen, setEditorOpen] = useState(false);
  const [manualSelection, setManualSelection] = useState<ManualSelection | null>(null);
  const [leadOppId, setLeadOppId] = useState<string | null>(null);

  const matrix = useMemo(() => buildMatchupMatrix(party, opponents), [party, opponents]);
  const { picks, warnings } = useMemo(
    () => rankSelections(party, opponents, matrix),
    [party, opponents, matrix],
  );

  const [aiPicks, setAiPicks] = useState<SelectionPick[] | null>(null);
  const [aiWarnings, setAiWarnings] = useState<string[] | null>(null);
  const [status, setStatus] = useState<ExplainStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // 相手入力・マトリクスが変わったら、古いAI強化結果は破棄する
  useEffect(() => {
    setAiPicks(null);
    setAiWarnings(null);
    setStatus('idle');
    setError(null);
  }, [picks, warnings]);

  const isManualSelection = Boolean(manualSelection && manualSelection.memberIds.length > 0);
  const manualPicks = useMemo<SelectionPick[]>(() => {
    if (!manualSelection || manualSelection.memberIds.length === 0) return [];
    return manualSelection.memberIds.map((id) => {
      const member = party.find((m) => m.id === id);
      if (!member) return null;
      const role = manualSelection.leadId === id ? '先発' : '後発';
      return describeMemberPick(member, opponents, matrix, role);
    }).filter((p): p is SelectionPick => Boolean(p));
  }, [manualSelection, party, opponents, matrix]);

  const activePicks = isManualSelection ? manualPicks : aiPicks ?? picks;

  // 推奨選出が変わったら、まだ手動編集していない場合のデフォルト選択肢として同期する
  const selectionForEditor: ManualSelection = manualSelection ?? {
    memberIds: picks.map((p) => p.memberId),
    leadId: picks.find((p) => p.role === '先発')?.memberId ?? picks[0]?.memberId ?? null,
  };

  // ユーザーが明示的に選んだ相手の先発を優先し、未選択なら型判明済みの先頭を仮の既定値にする
  const effectiveLeadOppId =
    (leadOppId && opponents.some((o) => o.id === leadOppId && o.species) ? leadOppId : undefined) ??
    opponents.find((o) => o.spreads?.length)?.id ??
    opponents[0]?.id ??
    null;

  function handleStartBattle() {
    const bench = activePicks.map((p) => party.find((m) => m.id === p.memberId)).filter((m): m is NonNullable<typeof m> => Boolean(m));
    if (!bench.length) return;
    const lead = activePicks.find((p) => p.role === '先発') ?? activePicks[0];
    if (!effectiveLeadOppId) return;
    startBattle(bench, opponents, lead.memberId, effectiveLeadOppId);
    router.push('/battle');
  }

  async function handleExplain() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party, opponents, matrix, picks: activePicks, warnings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAiPicks(data.picks);
      setAiWarnings(data.warnings);
      setStatus('idle');
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <HeaderBar />

      <div className="mt-4">
        <OpponentInput slots={opponents} onChange={setOpponents} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="lg:h-[520px]">
          <PartyPanel party={party} onEdit={() => setEditorOpen(true)} />
        </div>
        <div className="lg:h-[520px]">
          <MatchupHeatmap party={party} opponents={opponents} matrix={matrix} />
        </div>
      </div>

      <div className="mt-4">
        <SelectionEditor
          party={party}
          selection={selectionForEditor}
          onChange={(next) => {
            setManualSelection(next);
            setAiPicks(null);
            setAiWarnings(null);
          }}
          onResetToRecommended={() => {
            setManualSelection(null);
            setAiPicks(null);
            setAiWarnings(null);
          }}
          isManual={isManualSelection}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-hud-faint">
          {aiPicks ? 'Gemini生成の理由付け' : 'エンジン生成の理由付け（簡易）'}
        </span>
        <button
          type="button"
          onClick={handleExplain}
          disabled={status === 'loading' || !activePicks.length}
          className="rounded-sm border border-hud-cyan/50 bg-hud-cyan/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-hud-cyan transition hover:bg-hud-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'loading' ? '生成中…' : 'Geminiで理由を強化'}
        </button>
      </div>
      {error && <p className="mt-1 font-mono text-[11px] text-advantage-mildRisk">{error}</p>}

      <div className="mt-2">
        <SelectionRecommendation party={party} picks={activePicks} warnings={aiWarnings ?? warnings} />
      </div>

      <div className="mt-4">
        <SelectionGtSection
          party={party}
          opponents={opponents}
          onApply={(sel) => {
            setManualSelection(sel);
            setAiPicks(null);
            setAiWarnings(null);
          }}
        />
      </div>

      <div className="mt-4">
        <OpponentLeadPicker opponents={opponents} leadId={effectiveLeadOppId} onChange={setLeadOppId} />
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleStartBattle}
          disabled={!activePicks.length}
          className="rounded-sm border border-hud-amber/50 bg-hud-amber/10 px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-hud-amber transition hover:bg-hud-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          この選出で対戦開始 ▶
        </button>
      </div>

      {editorOpen && <PartyEditor onClose={() => setEditorOpen(false)} />}
    </main>
  );
}

function HeaderBar() {
  return (
    <header className="relative flex flex-wrap items-center justify-between gap-2 overflow-hidden border border-hud-line bg-hud-panel px-4 py-3">
      <div className="absolute left-0 top-0 h-full w-24 -translate-x-full animate-scan bg-gradient-to-r from-transparent via-hud-cyan/10 to-transparent" />
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-2xl font-black uppercase tracking-wide text-hud-text">
          Battle Ops
        </h1>
        <span className="font-mono text-[11px] uppercase tracking-widest text-hud-faint">
          対戦補佐ターミナル — シングル
        </span>
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px] text-hud-dim">
        <span>レギュレーション M-B</span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-hud-cyan" />
          <span className="uppercase tracking-widest text-hud-cyan">Live Analysis</span>
        </div>
      </div>
    </header>
  );
}
