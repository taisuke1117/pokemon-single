'use client';

import { useEffect, useMemo, useState } from 'react';
import { moveJa } from '@/lib/data/move-ja';
import { getMoveCategory } from '@/lib/engine/infer';
import { HpValueInput } from './HpValueInput';
import type { TurnActionSpec, TurnObservation } from '@/lib/engine/gt/bridge/apply-turn';
import type { AdvanceTurnResult } from '@/store/battle-store';
import type { OpponentSlot, PartyMember, BattleParticipant } from '@/lib/types';

/** @pkmn/sim の toID() と同じ正規化（小文字化+英数字以外除去）。
 *  クライアントバンドルを肥大化させないよう @pkmn/sim をimportせず自前実装する。 */
function toID(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

interface SwitchOption {
  id: string;
  label: string;
}

/**
 * 1ターン分の行動を「自分」「相手」左右に入力し、下段の乱数（急所・追加効果・結果HP）込みで
 * @pkmn/sim駆動のadvanceTurnへまとめて渡す。交代も行動の一種として選べる
 * （瀕死後の強制送り出しは既存のswitchInSelf/switchInOppフローが別途担当）。
 * 先手/後手はここで入力せず、右側の対戦ログの出現順で確認する（同速タイのみsim任せ）。
 */
export function TurnPanel({
  turn,
  selfActive,
  oppActiveSlot,
  selfParticipant,
  oppParticipant,
  liveBench,
  remainingOpp,
  selfParticipantsById,
  oppParticipantsById,
  onAdvance,
}: {
  turn: number;
  selfActive: PartyMember;
  oppActiveSlot: OpponentSlot;
  selfParticipant: BattleParticipant;
  oppParticipant: BattleParticipant;
  /** 自分の生存中の控え（交代先候補）。 */
  liveBench: PartyMember[];
  /** 相手の生存中の判明枠（交代先候補）。 */
  remainingOpp: OpponentSlot[];
  /** 自分側メンバー全員のBattleParticipant（refId→状態）。交代先のHP%を参照するために使う。 */
  selfParticipantsById: Record<string, BattleParticipant>;
  /** 相手側メンバー全員のBattleParticipant（slotId→状態）。交代先のHP%を参照するために使う。 */
  oppParticipantsById: Record<string, BattleParticipant>;
  onAdvance: (
    selfAction: TurnActionSpec,
    oppAction: TurnActionSpec,
    selfObserved?: TurnObservation,
    oppObserved?: TurnObservation,
  ) => AdvanceTurnResult;
}) {
  const [selfType, setSelfType] = useState<'move' | 'switch'>('move');
  const [selfMoveId, setSelfMoveId] = useState('');
  const [selfCrit, setSelfCrit] = useState(false);
  const [selfHpAfter, setSelfHpAfter] = useState(oppParticipant.currentHpPercent);
  const [selfSecondary, setSelfSecondary] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [selfSwitchToId, setSelfSwitchToId] = useState('');
  const [selfMega, setSelfMega] = useState(false);

  const [oppType, setOppType] = useState<'move' | 'switch'>('move');
  const [oppMoveId, setOppMoveId] = useState('');
  const [oppCrit, setOppCrit] = useState(false);
  const [oppHpAfter, setOppHpAfter] = useState(selfParticipant.currentHpPercent);
  const [oppSecondary, setOppSecondary] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [oppSwitchToId, setOppSwitchToId] = useState('');
  const [oppMega, setOppMega] = useState(false);

  const [message, setMessage] = useState<{ text: string; isError: boolean } | undefined>();

  // こだわり系アイテムで技が縛られている場合、選択肢をその技のみに絞る
  // （choiceLockedMoveIdはsim小文字ID表記なので、正式表記の技名をtoIDしてから比較する）。
  const selfMoveOptions = useMemo(() => {
    const all = selfActive.calc.moveIds ?? [];
    const locked = selfParticipant.choiceLockedMoveId;
    if (!locked) return all;
    const filtered = all.filter((m) => toID(m) === locked);
    return filtered.length > 0 ? filtered : all;
  }, [selfActive, selfParticipant.choiceLockedMoveId]);
  const oppMoveOptions = useMemo(() => {
    const all = [...new Set(oppActiveSlot.moveUsage?.map((m) => m.moveId) ?? [])];
    const locked = oppParticipant.choiceLockedMoveId;
    if (!locked) return all;
    const filtered = all.filter((m) => toID(m) === locked);
    return filtered.length > 0 ? filtered : all;
  }, [oppActiveSlot, oppParticipant.choiceLockedMoveId]);

  // choiceLockedMoveId(sim小文字ID)に対応する正式表記の技名をmoveOptionsから逆引きする（表示用）。
  const selfLockedLabel = useMemo(() => {
    const locked = selfParticipant.choiceLockedMoveId;
    if (!locked) return undefined;
    const match = (selfActive.calc.moveIds ?? []).find((m) => toID(m) === locked);
    return moveJa(match ?? locked);
  }, [selfActive, selfParticipant.choiceLockedMoveId]);
  const oppLockedLabel = useMemo(() => {
    const locked = oppParticipant.choiceLockedMoveId;
    if (!locked) return undefined;
    const match = (oppActiveSlot.moveUsage ?? []).find((m) => toID(m.moveId) === locked);
    return moveJa(match?.moveId ?? locked);
  }, [oppActiveSlot, oppParticipant.choiceLockedMoveId]);
  const selfSwitchOptions: SwitchOption[] = liveBench.map((m) => ({ id: m.id, label: m.name }));
  const oppSwitchOptions: SwitchOption[] = remainingOpp.map((o) => ({ id: o.id, label: o.resolvedName ?? o.query }));

  // 相手の技が実際に当たる自分側の対象: 自分が同ターンに交代を選んでいれば「交代後に場に出る控え」、
  // そうでなければ現在のアクティブ。交代直後のポケモンのHP%/実数値を基準にHP入力欄を出すため。
  const selfDamageTarget = useMemo(() => {
    if (selfType === 'switch' && selfSwitchToId) {
      const member = liveBench.find((m) => m.id === selfSwitchToId);
      const participant = selfParticipantsById[selfSwitchToId];
      if (member) {
        return { name: member.name, maxHp: member.stats.h, hpPercent: participant?.currentHpPercent ?? 100, isSwitchIn: true };
      }
    }
    return { name: selfActive.name, maxHp: selfActive.stats.h, hpPercent: selfParticipant.currentHpPercent, isSwitchIn: false };
  }, [selfType, selfSwitchToId, liveBench, selfParticipantsById, selfActive, selfParticipant]);

  // 自分の技が実際に当たる相手側の対象: 相手が同ターンに交代を選んでいれば「交代後に場に出る控え」。
  const oppDamageTarget = useMemo(() => {
    if (oppType === 'switch' && oppSwitchToId) {
      const slot = remainingOpp.find((o) => o.id === oppSwitchToId);
      const participant = oppParticipantsById[oppSwitchToId];
      if (slot) {
        return { name: slot.resolvedName ?? slot.query, hpPercent: participant?.currentHpPercent ?? 100, isSwitchIn: true };
      }
    }
    return { name: oppActiveSlot.resolvedName ?? '相手', hpPercent: oppParticipant.currentHpPercent, isSwitchIn: false };
  }, [oppType, oppSwitchToId, remainingOpp, oppParticipantsById, oppActiveSlot, oppParticipant]);

  // 対象(交代先/アクティブ)が切り替わったら、結果HP入力のデフォルト値をその対象の現在HP%に合わせ直す
  // （交代直後は基本満タンだが、瀕死一歩手前から控えに引っ込めていた個体等は既にダメージを負っている）。
  useEffect(() => {
    setOppHpAfter(selfDamageTarget.hpPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfType, selfSwitchToId]);
  useEffect(() => {
    setSelfHpAfter(oppDamageTarget.hpPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppType, oppSwitchToId]);

  function resetForm() {
    setSelfType('move');
    setSelfMoveId('');
    setSelfCrit(false);
    setSelfSecondary('unknown');
    setSelfSwitchToId('');
    setSelfMega(false);
    setOppType('move');
    setOppMoveId('');
    setOppCrit(false);
    setOppSecondary('unknown');
    setOppSwitchToId('');
    setOppMega(false);
  }

  function handleConfirm() {
    const selfAction: TurnActionSpec | undefined =
      selfType === 'move'
        ? (selfMoveId ? { kind: 'move', moveId: selfMoveId, mega: selfMega || undefined } : undefined)
        : selfSwitchToId ? { kind: 'switch', toRefId: selfSwitchToId } : undefined;
    const oppAction: TurnActionSpec | undefined =
      oppType === 'move'
        ? (oppMoveId ? { kind: 'move', moveId: oppMoveId, mega: oppMega || undefined } : undefined)
        : oppSwitchToId ? { kind: 'switch', toRefId: oppSwitchToId } : undefined;

    if (!selfAction || !oppAction) {
      setMessage({ text: '両者の行動を選択してください（技を選ぶか、交代先を選んでください）', isError: true });
      return;
    }

    // 変化技（つるぎのまい等）はHPを変化させないため観測を記録しない
    // （HP入力欄は残っていても無視し、observationsを汚染しないようにする）。
    const selfIsDamaging = selfType === 'move' && Boolean(selfMoveId) && getMoveCategory(selfMoveId) !== 'Status';
    const oppIsDamaging = oppType === 'move' && Boolean(oppMoveId) && getMoveCategory(oppMoveId) !== 'Status';

    const selfObserved: TurnObservation | undefined = selfIsDamaging
      ? { wasCrit: selfCrit, hpPercentAfter: selfHpAfter, secondaryProcced: selfSecondary === 'unknown' ? undefined : selfSecondary === 'yes' }
      : undefined;
    const oppObserved: TurnObservation | undefined = oppIsDamaging
      ? { wasCrit: oppCrit, hpPercentAfter: oppHpAfter, secondaryProcced: oppSecondary === 'unknown' ? undefined : oppSecondary === 'yes' }
      : undefined;

    const result = onAdvance(selfAction, oppAction, selfObserved, oppObserved);
    if (!result.ok) {
      setMessage({ text: result.error ?? '不明なエラーでターンを進められませんでした', isError: true });
      return;
    }
    setMessage(result.warning ? { text: result.warning, isError: false } : undefined);
    resetForm();
  }

  return (
    <section className="flex flex-col gap-3 border border-hud-line bg-hud-panel p-3">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">ターン{turn}の行動を登録</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SideBlock
          testIdPrefix="self"
          label={`${selfActive.name}（自分）`}
          accent="cyan"
          actionType={selfType}
          onActionTypeChange={setSelfType}
          moveOptions={selfMoveOptions}
          moveId={selfMoveId}
          onMoveIdChange={setSelfMoveId}
          crit={selfCrit}
          onCritChange={setSelfCrit}
          hpAfter={selfHpAfter}
          onHpAfterChange={setSelfHpAfter}
          hpMaxHp={undefined}
          hpLabel={`${oppDamageTarget.name}${oppDamageTarget.isSwitchIn ? '（交代後）' : ''}の結果HP（命中前${Math.round(oppDamageTarget.hpPercent)}%）`}
          secondary={selfSecondary}
          onSecondaryChange={setSelfSecondary}
          switchOptions={selfSwitchOptions}
          switchToId={selfSwitchToId}
          onSwitchToIdChange={setSelfSwitchToId}
          lockedMoveLabel={selfLockedLabel}
          trapped={selfParticipant.trapped}
          showMegaOption={Boolean(selfActive.isMega) && !selfParticipant.megaUsed}
          mega={selfMega}
          onMegaChange={setSelfMega}
        />
        <SideBlock
          testIdPrefix="opp"
          label={`${oppActiveSlot.resolvedName ?? '相手'}（相手）`}
          accent="amber"
          actionType={oppType}
          onActionTypeChange={setOppType}
          moveOptions={oppMoveOptions}
          moveId={oppMoveId}
          onMoveIdChange={setOppMoveId}
          crit={oppCrit}
          onCritChange={setOppCrit}
          hpAfter={oppHpAfter}
          onHpAfterChange={setOppHpAfter}
          hpMaxHp={selfDamageTarget.maxHp}
          hpLabel={`${selfDamageTarget.name}${selfDamageTarget.isSwitchIn ? '（交代後）' : ''}の結果HP（命中前${Math.round(selfDamageTarget.hpPercent)}%）`}
          secondary={oppSecondary}
          onSecondaryChange={setOppSecondary}
          switchOptions={oppSwitchOptions}
          switchToId={oppSwitchToId}
          onSwitchToIdChange={setOppSwitchToId}
          lockedMoveLabel={oppLockedLabel}
          trapped={oppParticipant.trapped}
          showMegaOption={!oppParticipant.megaUsed}
          mega={oppMega}
          onMegaChange={setOppMega}
        />
      </div>

      {message && (
        <p className={`text-[11px] ${message.isError ? 'text-advantage-strongRisk' : 'text-hud-amber'}`}>{message.text}</p>
      )}

      <button
        type="button"
        data-testid="turn-confirm"
        onClick={handleConfirm}
        className="border border-hud-amber/50 bg-hud-amber/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-hud-amber transition hover:bg-hud-amber/20"
      >
        ターンを確定して次のターンへ ▶
      </button>
    </section>
  );
}

function SideBlock({
  label,
  accent,
  actionType,
  onActionTypeChange,
  moveOptions,
  moveId,
  onMoveIdChange,
  crit,
  onCritChange,
  hpAfter,
  onHpAfterChange,
  hpMaxHp,
  hpLabel,
  secondary,
  onSecondaryChange,
  switchOptions,
  switchToId,
  onSwitchToIdChange,
  testIdPrefix,
  lockedMoveLabel,
  trapped,
  showMegaOption,
  mega,
  onMegaChange,
}: {
  label: string;
  accent: 'cyan' | 'amber';
  testIdPrefix: string;
  actionType: 'move' | 'switch';
  onActionTypeChange: (v: 'move' | 'switch') => void;
  moveOptions: string[];
  moveId: string;
  onMoveIdChange: (v: string) => void;
  crit: boolean;
  onCritChange: (v: boolean) => void;
  hpAfter: number;
  onHpAfterChange: (v: number) => void;
  hpMaxHp?: number;
  hpLabel: string;
  secondary: 'unknown' | 'yes' | 'no';
  onSecondaryChange: (v: 'unknown' | 'yes' | 'no') => void;
  switchOptions: SwitchOption[];
  switchToId: string;
  onSwitchToIdChange: (v: string) => void;
  /** こだわり系アイテムで縛られている技の日本語名（あれば技選択肢の上に警告表示）。 */
  lockedMoveLabel?: string;
  /** 交代不可（ありじごく/くろいまなざし/かげふみ等）。真なら「交代」タブを無効化する。 */
  trapped?: boolean;
  /** メガシンカ選択肢を出すか（自分:isMega且つ未使用、相手:未使用なら常に出す＝相手情報は不確実なため）。 */
  showMegaOption?: boolean;
  mega: boolean;
  onMegaChange: (v: boolean) => void;
}) {
  const accentClass = accent === 'cyan' ? 'border-hud-cyan/40' : 'border-hud-amber/40';
  return (
    <div className={`border ${accentClass} bg-hud-panelAlt p-2.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-hud-text">{label}</span>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid={`${testIdPrefix}-type-move`}
            onClick={() => onActionTypeChange('move')}
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${actionType === 'move' ? 'border-hud-cyan/60 bg-hud-cyan/15 text-hud-cyan' : 'border-hud-line text-hud-faint'}`}
          >
            技
          </button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-type-switch`}
            onClick={() => onActionTypeChange('switch')}
            disabled={trapped}
            title={trapped ? '交代不可の状態です' : undefined}
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase transition disabled:cursor-not-allowed disabled:opacity-30 ${actionType === 'switch' ? 'border-hud-cyan/60 bg-hud-cyan/15 text-hud-cyan' : 'border-hud-line text-hud-faint'}`}
          >
            交代
          </button>
        </div>
      </div>

      {actionType === 'move' && lockedMoveLabel && (
        <p className="mt-1.5 text-[10px] text-hud-amber">こだわり系アイテムで「{lockedMoveLabel}」に縛られています</p>
      )}
      {actionType === 'move' ? (
        <div className="mt-2 flex flex-col gap-2">
          <select
            data-testid={`${testIdPrefix}-move-select`}
            value={moveId}
            onChange={(e) => onMoveIdChange(e.target.value)}
            className="border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
          >
            <option value="">技を選択</option>
            {moveOptions.map((m) => (
              <option key={m} value={m}>
                {moveJa(m)}
              </option>
            ))}
          </select>

          {moveId && showMegaOption && (
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  data-testid={`${testIdPrefix}-mega-checkbox`}
                  checked={mega}
                  onChange={(e) => onMegaChange(e.target.checked)}
                />
                <span className="text-[10px] text-hud-text">メガシンカして</span>
              </label>
            </div>
          )}

          {moveId && getMoveCategory(moveId) !== 'Status' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 border border-hud-line bg-hud-panel px-2 py-1.5">
                <input type="checkbox" checked={crit} onChange={(e) => onCritChange(e.target.checked)} />
                <span className="text-[11px] text-hud-text">急所</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wide text-hud-faint">{hpLabel}</span>
                <HpValueInput
                  percent={hpAfter}
                  onChangePercent={onHpAfterChange}
                  maxHp={hpMaxHp}
                  className="w-full border border-hud-line bg-hud-panel px-2 py-1 text-center font-mono text-[12px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
                  testId={`${testIdPrefix}-hp-input`}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wide text-hud-faint">確率追加効果は発動したか</span>
                <select
                  data-testid={`${testIdPrefix}-secondary-select`}
                  value={secondary}
                  onChange={(e) => onSecondaryChange(e.target.value as typeof secondary)}
                  className="border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
                >
                  <option value="unknown">対象外・不明</option>
                  <option value="yes">発動した</option>
                  <option value="no">発動しなかった</option>
                </select>
              </label>
            </div>
          )}
          {moveId && getMoveCategory(moveId) === 'Status' && (
            <p className="text-[10px] text-hud-faint">変化技のため結果HPの入力は不要です</p>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <select
            data-testid={`${testIdPrefix}-switch-select`}
            value={switchToId}
            onChange={(e) => onSwitchToIdChange(e.target.value)}
            className="w-full border border-hud-line bg-hud-panel px-2 py-1.5 text-[12px] text-hud-text focus:border-hud-cyan/50 focus:outline-none"
          >
            <option value="">交代先を選択</option>
            {switchOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {switchOptions.length === 0 && <p className="mt-1 text-[10px] text-hud-faint">交代できる控えがいません</p>}
        </div>
      )}
    </div>
  );
}
