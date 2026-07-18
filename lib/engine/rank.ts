import { isMegaStoneItem } from '../calc/dex';
import type { MatchupCell, OpponentSlot, PartyMember, SelectionPick } from '../types';

/** このメンバーを選出すると「メガシンカ枠」を消費するか（種族自体がメガ、またはメガストーン所持）。 */
function isMegaPick(member: PartyMember): boolean {
  return member.isMega === true || isMegaStoneItem(member.calc.itemId);
}

interface MemberAggregate {
  member: PartyMember;
  avgScore: number;
  speedWins: number;
  best: { opponent: OpponentSlot; cell: MatchupCell }[];
  worst: { opponent: OpponentSlot; cell: MatchupCell }[];
}

function aggregateMember(
  member: PartyMember,
  opponents: OpponentSlot[],
  matrix: Record<string, Record<string, MatchupCell>>,
): MemberAggregate {
  const entries = opponents
    .map((o) => ({ opponent: o, cell: matrix[member.id]?.[o.id] }))
    .filter((e): e is { opponent: OpponentSlot; cell: MatchupCell } => Boolean(e.cell));

  const avgScore = entries.length ? entries.reduce((sum, e) => sum + e.cell.score, 0) / entries.length : 0;
  const speedWins = entries.filter((e) => e.cell.speed === 'win').length;

  const sorted = [...entries].sort((a, b) => b.cell.score - a.cell.score);
  return {
    member,
    avgScore,
    speedWins,
    best: sorted.slice(0, 2),
    worst: sorted.slice(-2).reverse(),
  };
}

function describeCell(opponent: OpponentSlot, cell: MatchupCell, direction: 'good' | 'bad'): string {
  const name = opponent.resolvedName ?? '相手';
  if (direction === 'good') {
    return `${name}に対して${cell.atkRange}(${cell.atkKo})を取れる（${cell.speed === 'win' ? '先手' : cell.speed === 'lose' ? '後手' : '同速'}）`;
  }
  return `${name}相手に${cell.defRange}(${cell.defKo})の被弾を受けるリスクがある`;
}

/**
 * 1匹分の選出理由/警戒点を相性マトリクスから組み立てる。
 * エンジンの自動選出(rankSelections)・ユーザーによる手動選出の両方から使う共通ロジック。
 */
export function describeMemberPick(
  member: PartyMember,
  opponents: OpponentSlot[],
  matrix: Record<string, Record<string, MatchupCell>>,
  role: '先発' | '後発',
): SelectionPick {
  const resolvedOpponents = opponents.filter((o) => o.spreads?.length);
  const agg = aggregateMember(member, resolvedOpponents, matrix);
  const reasons = agg.best.map((b) => describeCell(b.opponent, b.cell, 'good'));
  const watchOut = agg.worst
    .filter((w) => w.cell.verdict === 'mildRisk' || w.cell.verdict === 'strongRisk')
    .map((w) => describeCell(w.opponent, w.cell, 'bad'));
  return {
    memberId: member.id,
    role,
    reasons: reasons.length ? reasons : ['相手全体に対して大きな失点なく立ち回れる'],
    watchOut: watchOut.length ? watchOut : ['現時点で大きな警戒点なし'],
  };
}

/** 相性マトリクスから選出3匹＋役割＋理由を生成する。 */
export function rankSelections(
  party: PartyMember[],
  opponents: OpponentSlot[],
  matrix: Record<string, Record<string, MatchupCell>>,
): { picks: SelectionPick[]; warnings: string[] } {
  const resolvedOpponents = opponents.filter((o) => o.spreads?.length);
  const aggregates = party
    .map((m) => aggregateMember(m, resolvedOpponents, matrix))
    .sort((a, b) => b.avgScore - a.avgScore);

  // メガシンカは1戦につき1体までしか発動できないため、
  // 評価スコアが高くても2体目以降のメガ候補は見送り、次点の非メガ候補に譲る。
  const top3: typeof aggregates = [];
  const skippedMegaNames: string[] = [];
  let megaCount = 0;
  for (const agg of aggregates) {
    if (top3.length >= 3) break;
    if (isMegaPick(agg.member) && megaCount >= 1) {
      skippedMegaNames.push(agg.member.name);
      continue;
    }
    top3.push(agg);
    if (isMegaPick(agg.member)) megaCount++;
  }
  // 手持ちの大半がメガ候補等でどうしても3体埋まらない場合は、制約を緩めて埋める
  if (top3.length < 3) {
    for (const agg of aggregates) {
      if (top3.length >= 3) break;
      if (top3.includes(agg)) continue;
      top3.push(agg);
    }
  }

  // 最も相手より先手を取りやすい（speedWins最多）駒を先発に
  const starterIndex = top3.reduce(
    (bestIdx, cur, idx, arr) => (cur.speedWins > arr[bestIdx].speedWins ? idx : bestIdx),
    0,
  );

  const picks: SelectionPick[] = top3.map((agg, idx) =>
    describeMemberPick(agg.member, opponents, matrix, idx === starterIndex ? '先発' : '後発'),
  );

  const warnings: string[] = [];
  if (skippedMegaNames.length) {
    warnings.push(
      `${skippedMegaNames.join('・')}はスコア上位だがメガシンカ候補が既に1体選出されているため見送り（1戦でメガシンカできるのは1体まで）`,
    );
  }
  const unconfirmed = resolvedOpponents.filter((o) => !o.confirmed);
  if (unconfirmed.length) {
    warnings.push(
      `${unconfirmed.map((o) => o.resolvedName).join('・')}は型未確定。代表型を基準に判定しているため、実戦の持ち物・技次第で評価が変わる点に注意`,
    );
  }
  const unresolvedCount = opponents.length - resolvedOpponents.length;
  if (unresolvedCount > 0) {
    warnings.push(`相手${unresolvedCount}枠が未入力。情報が揃うほど選出提案の精度が上がる`);
  }

  return { picks, warnings };
}
