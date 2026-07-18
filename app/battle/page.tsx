'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePartyMembers } from '@/store/party-store';
import { useBattleStore } from '@/store/battle-store';
import { compareSpeed, rankMoves, rankSwitchIns } from '@/lib/engine/battle';
import { summarizeOpponentInference } from '@/lib/engine/infer';
import { pickPrimarySpread, spreadToCalcSpec } from '@/lib/engine/matchup';
import { getSpecies } from '@/lib/calc/dex';
import { itemJa } from '@/lib/data/item-ja';
import { abilityJa } from '@/lib/data/ability-ja';
import { ActivePokemonCard } from '@/components/battle/ActivePokemonCard';
import { OpponentRevealForm } from '@/components/battle/OpponentRevealForm';
import { FieldStatusBar } from '@/components/battle/FieldStatusBar';
import { SideConditionEditor } from '@/components/battle/SideConditionEditor';
import { TurnPanel } from '@/components/battle/TurnPanel';
import { BattleLogPanel } from '@/components/battle/BattleLogPanel';
import { MoveSuggestionPanel } from '@/components/battle/MoveSuggestionPanel';
import { SwitchInPanel } from '@/components/battle/SwitchInPanel';
import { InferencePanel } from '@/components/battle/InferencePanel';
import { GtAnalysisSection } from '@/components/battle/gt/GtAnalysisSection';
import { CurrentEvalBadge } from '@/components/battle/CurrentEvalBadge';
import { OpponentRosterPanel } from '@/components/battle/OpponentRosterPanel';
import { PokemonSprite } from '@/components/PokemonSprite';
import type { CalcSpec, PartyMember } from '@/lib/types';

export default function BattlePage() {
  const router = useRouter();
  const party = usePartyMembers();
  const battle = useBattleStore();

  const selfActive = party.find((m) => m.id === battle.state.selfActiveMemberId);
  const oppActiveSlot = battle.opponents.find((o) => o.id === battle.state.oppActiveSlotId);
  const bench = battle.benchMemberIds
    .map((id) => party.find((m) => m.id === id))
    .filter((m): m is PartyMember => Boolean(m));

  const selfCalcById = useMemo(() => Object.fromEntries(bench.map((m) => [m.id, m.calc])), [bench]);

  const oppPrimary = oppActiveSlot ? pickPrimarySpread(oppActiveSlot) : undefined;
  const oppCalc: CalcSpec | undefined =
    oppActiveSlot?.species && oppPrimary ? spreadToCalcSpec(oppActiveSlot.species, oppPrimary) : undefined;

  const selfParticipant = selfActive ? battle.state.self[selfActive.id] : undefined;
  const oppParticipant = oppActiveSlot ? battle.state.opponent[oppActiveSlot.id] : undefined;

  const selfFainted = (selfParticipant?.currentHpPercent ?? 0) <= 0;
  const oppFainted = (oppParticipant?.currentHpPercent ?? 0) <= 0;

  const liveBench = bench.filter((m) => m.id !== selfActive?.id && (battle.state.self[m.id]?.currentHpPercent ?? 100) > 0);
  const remainingOpp = battle.opponents.filter((o) => o.id !== oppActiveSlot?.id && o.species);

  const moveRanking = useMemo(() => {
    if (!selfActive || !oppActiveSlot || !selfParticipant || !oppParticipant) return [];
    return rankMoves(selfActive, selfParticipant, oppActiveSlot, oppParticipant, battle.state.field);
  }, [selfActive, oppActiveSlot, selfParticipant, oppParticipant, battle.state.field]);

  const speedResult = useMemo(() => {
    if (!selfActive || !oppCalc || !selfParticipant || !oppParticipant) return 'speedTie' as const;
    return compareSpeed(selfActive.calc, selfParticipant, oppCalc, oppParticipant, battle.state.field);
  }, [selfActive, oppCalc, selfParticipant, oppParticipant, battle.state.field]);

  const switchInRanking = useMemo(() => {
    if (!selfActive || !oppActiveSlot || !selfParticipant || !oppParticipant) return [];
    return rankSwitchIns(
      liveBench,
      battle.state.self,
      selfActive.calc,
      selfParticipant,
      oppActiveSlot,
      oppParticipant,
      battle.state.field,
    );
  }, [liveBench, battle.state.self, selfActive, oppActiveSlot, selfParticipant, oppParticipant, battle.state.field]);

  const inferenceSummary = useMemo(() => {
    if (!oppActiveSlot || !oppParticipant) return undefined;
    return summarizeOpponentInference(oppActiveSlot.id, battle.state.observations, selfCalcById, oppActiveSlot, oppParticipant);
  }, [oppActiveSlot, oppParticipant, battle.state.observations, selfCalcById]);

  function handleEndBattle() {
    battle.endBattle();
    router.push('/');
  }

  if (!battle.active || !selfActive || !oppActiveSlot || !selfParticipant || !oppParticipant) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="font-display text-lg font-bold text-hud-text">対戦データがありません</h1>
        <p className="text-[12px] text-hud-dim">
          ホーム画面の「この選出で対戦開始」ボタンから対戦を開始してください。
        </p>
        <Link
          href="/"
          className="mt-2 border border-hud-cyan/50 bg-hud-cyan/10 px-4 py-2 font-mono text-[12px] uppercase tracking-wide text-hud-cyan hover:bg-hud-cyan/20"
        >
          ホームに戻る
        </Link>
      </main>
    );
  }

  const oppSpeciesInfo = oppActiveSlot.species ? getSpecies(oppActiveSlot.species) : undefined;
  const oppItemLabel = oppParticipant.revealedItemId
    ? itemJa(oppParticipant.revealedItemId)
    : oppPrimary
      ? `${oppPrimary.item}?`
      : '不明';
  const oppAbilityLabel = oppParticipant.revealedAbilityId
    ? abilityJa(oppParticipant.revealedAbilityId)
    : oppPrimary
      ? `${oppPrimary.ability}?`
      : '不明';

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <FieldStatusBar
        turn={battle.state.turn}
        field={battle.state.field}
        onChange={battle.updateField}
        onEndBattle={handleEndBattle}
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="turn-undo"
          onClick={battle.undoTurn}
          disabled={!battle.canUndo()}
          className="border border-hud-line px-2 py-1 font-mono text-[10px] text-hud-dim transition enabled:hover:bg-hud-panelAlt disabled:opacity-30"
          title="直前のターン確定を取り消す（入力ミス時用）"
        >
          ◀ 1ターン戻る
        </button>
        <CurrentEvalBadge state={battle.state} bench={bench} opponents={battle.opponents} />
      </div>

      <div className="mt-3">
        <OpponentRosterPanel
          opponents={battle.opponents}
          participants={battle.state.opponent}
          activeSlotId={battle.state.oppActiveSlotId}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <SideConditionEditor label="自陣" side={battle.state.field.selfSide} onChange={battle.updateSelfSide} />
        <SideConditionEditor label="相手陣" side={battle.state.field.oppSide} onChange={battle.updateOppSide} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ActivePokemonCard
          name={selfActive.name}
          species={selfActive.calc.species}
          types={selfActive.types}
          itemLabel={selfActive.item}
          abilityLabel={selfActive.ability}
          participant={selfParticipant}
          onUpdate={(patch) => battle.updateSelfParticipant(selfActive.id, patch)}
          accent="cyan"
          maxHp={selfActive.stats.h}
        />
        <ActivePokemonCard
          name={oppActiveSlot.resolvedName ?? oppActiveSlot.query}
          species={oppActiveSlot.species}
          types={oppActiveSlot.types}
          itemLabel={oppItemLabel}
          abilityLabel={oppAbilityLabel}
          participant={oppParticipant}
          onUpdate={(patch) => battle.updateOppParticipant(oppActiveSlot.id, patch)}
          accent="amber"
          revealSection={
            <OpponentRevealForm
              participant={oppParticipant}
              onUpdate={(patch) => battle.updateOppParticipant(oppActiveSlot.id, patch)}
              abilityOptions={oppSpeciesInfo?.abilities ?? []}
            />
          }
        />
      </div>

      <section
        className={`mt-3 border p-3 ${
          oppFainted ? 'border-advantage-strongRisk/60 bg-advantage-strongRisk/5' : 'border-hud-line bg-hud-panel'
        }`}
      >
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">
          {oppFainted ? '相手の次の1体を選択（瀕死）' : '相手の場のポケモンを入力・切り替え'}
        </h3>
        {!oppFainted && (
          <p className="mt-1 text-[10px] text-hud-faint">
            相手が瀕死以外で自発的に交代した場合も、実際に場に出たポケモンをここで選んでください（ステルスロック等は自動反映されます）。
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {remainingOpp.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => battle.switchInOpp(slot, pickPrimarySpread(slot)?.abilityId)}
              className="flex items-center gap-1.5 border border-hud-line bg-hud-panelAlt px-2 py-1.5 hover:bg-hud-panel"
            >
              <PokemonSprite species={slot.species} name={slot.resolvedName ?? slot.query} types={slot.types} size="sm" />
              <span className="text-[11px] text-hud-text">{slot.resolvedName}</span>
              {slot.seenInBattle && <span className="font-mono text-[8px] text-hud-cyan">既出</span>}
            </button>
          ))}
          {remainingOpp.length === 0 && <p className="text-[11px] text-hud-faint">他に判明している相手枠がありません</p>}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {!selfFainted && !oppFainted && (
            <TurnPanel
              turn={battle.state.turn}
              selfActive={selfActive}
              oppActiveSlot={oppActiveSlot}
              selfParticipant={selfParticipant}
              oppParticipant={oppParticipant}
              liveBench={liveBench}
              remainingOpp={remainingOpp}
              onAdvance={(selfAction, oppAction, selfObserved, oppObserved) =>
                battle.advanceTurn(bench, selfAction, oppAction, selfObserved, oppObserved)
              }
            />
          )}
          <InferencePanel summary={inferenceSummary} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!selfFainted && !oppFainted && <MoveSuggestionPanel moves={moveRanking} speed={speedResult} />}
            <SwitchInPanel
              bench={liveBench}
              ranking={switchInRanking}
              onSwitchIn={(m) => battle.switchInSelf(m)}
              urgent={selfFainted}
              trapped={selfParticipant.trapped}
            />
          </div>
        </div>
        <BattleLogPanel log={battle.battleLog} />
      </div>

      {!selfFainted && !oppFainted && (
        <div className="mt-3">
          <GtAnalysisSection state={battle.state} bench={bench} opponents={battle.opponents} />
        </div>
      )}
    </main>
  );
}
