/**
 * @pkmn/sim のプロトコルログ(battle.log: 文字列配列) → 対戦画面の右端ログ列用イベント列。
 *
 * 1ターンで起きた事象（攻撃・砂ダメ・毒ダメ・交代・追加効果・天候変化・ターン終了 等）を
 * 日本語のイベントに変換する。sim が吐く全事象を単一ソースとして扱う（次盤面の状態導出とは別に、
 * ここは表示専用）。`|split|SIDE` 直後は同一行が2回出るため重複を除去する。
 */
import { moveJa } from '../../data/move-ja';
import { itemJa } from '../../data/item-ja';
import { abilityJa } from '../../data/ability-ja';

export type TurnLogKind =
  | 'move' | 'damage' | 'residual' | 'heal' | 'faint' | 'status' | 'cure'
  | 'weather' | 'switch' | 'boost' | 'item' | 'ability' | 'hazard'
  | 'crit' | 'effectiveness' | 'miss' | 'cant' | 'endturn';

export interface TurnLogEvent {
  turn: number;
  side?: 'self' | 'opp';
  kind: TurnLogKind;
  /** 日本語の1行テキスト。 */
  text: string;
}

const STATUS_JA: Record<string, string> = {
  brn: 'やけど', par: 'まひ', psn: 'どく', tox: 'もうどく', slp: 'ねむり', frz: 'こおり',
};
/** |cant|の理由コード。状態異常系はSTATUS_JAと重複するキーもあるが文脈が違うため別マップにする。 */
const CANT_REASON_JA: Record<string, string> = {
  flinch: 'ひるんで', par: 'まひで', slp: 'ねむっていて', frz: 'こおっていて',
  nopp: 'PPが無くて', recharge: 'はんどうで', trapped: '交代封じで',
};
const STAT_JA: Record<string, string> = {
  atk: '攻撃', def: '防御', spa: '特攻', spd: '特防', spe: '素早さ', accuracy: '命中', evasion: '回避',
};
const WEATHER_JA: Record<string, string> = {
  Sandstorm: '砂嵐', 'Sunny Day': '晴れ', RainDance: '雨', Rain: '雨', Snow: 'あられ', Hail: 'あられ', SunnyDay: '晴れ', desolateland: '大日照',
};
const RESIDUAL_JA: Record<string, string> = {
  psn: 'どく', tox: 'もうどく', brn: 'やけど', Sandstorm: '砂嵐', Hail: 'あられ', 'Leech Seed': 'やどりぎ', 'Salt Cure': 'しおづけ', Curse: 'のろい',
};

interface Ctx {
  turn: number;
  /** refId(=set.name) → 日本語表示名。 */
  nameByRef: Map<string, string>;
}

/** "p1a: <refId>" → { side, name }。 */
function parseIdent(ident: string, ctx: Ctx): { side: 'self' | 'opp'; name: string } {
  const side: 'self' | 'opp' = ident.startsWith('p1') ? 'self' : 'opp';
  const ref = ident.slice(ident.indexOf(':') + 1).trim();
  return { side, name: ctx.nameByRef.get(ref) ?? ref };
}

/** "[from] item: Life Orb" 等の付随情報から原因文字列を取り出す。 */
function fromReason(parts: string[]): string | undefined {
  const seg = parts.find((p) => p.startsWith('[from]'));
  if (!seg) return undefined;
  return seg.replace('[from]', '').trim(); // 例: "item: Life Orb", "psn", "ability: Sand Stream"
}

function hpText(hp: string): string {
  // "165/183" → "165/183"、"0 fnt" → "0"
  return hp.replace(' fnt', '');
}

export function parseTurnLog(logLines: string[], ctx: Ctx): TurnLogEvent[] {
  const events: TurnLogEvent[] = [];
  let prevRaw = '';
  const push = (kind: TurnLogKind, text: string, side?: 'self' | 'opp') => events.push({ turn: ctx.turn, kind, text, side });

  for (const raw of logLines) {
    if (!raw.startsWith('|')) continue;
    if (raw.startsWith('|split|')) continue; // 直後の重複行のマーカー
    if (raw === prevRaw) continue; // split由来の重複除去
    prevRaw = raw;
    const parts = raw.split('|'); // parts[0]='' , parts[1]=cmd
    const cmd = parts[1];

    switch (cmd) {
      case 'move': {
        const u = parseIdent(parts[2], ctx);
        push('move', `${u.name}の${moveJa(parts[3])}`, u.side);
        break;
      }
      case '-damage': {
        const t = parseIdent(parts[2], ctx);
        const reason = fromReason(parts);
        const hp = hpText(parts[3]);
        if (reason) {
          // item:/ability: の値は "Life Orb" のような正式表記なので toID() を通さず itemJa/abilityJa へ
          // そのまま渡す（COMMON_ITEMS等のキーも正式表記）。pokemon: は化けの皮剥がれ等の1回限り
          // ダメージ表現に使われる特殊タグ。
          let label: string;
          if (reason.startsWith('item:')) {
            label = itemJa(reason.replace(/^item:\s*/, ''));
          } else if (reason.startsWith('ability:')) {
            const abilityName = reason.replace(/^ability:\s*/, '');
            label = RESIDUAL_JA[abilityName] ?? abilityJa(abilityName);
          } else if (reason.startsWith('pokemon:')) {
            label = 'ばけのかわ';
          } else {
            label = RESIDUAL_JA[reason] ?? reason;
          }
          push('residual', `${t.name}: ${label}ダメージ（→${hp}）`, t.side);
        } else {
          push('damage', `${t.name}に命中（→${hp}）`, t.side);
        }
        break;
      }
      case '-heal': {
        const t = parseIdent(parts[2], ctx);
        push('heal', `${t.name}が回復（→${hpText(parts[3])}）`, t.side);
        break;
      }
      case 'faint': {
        const t = parseIdent(parts[2], ctx);
        push('faint', `${t.name}はたおれた`, t.side);
        break;
      }
      case '-status': {
        const t = parseIdent(parts[2], ctx);
        push('status', `${t.name}は${STATUS_JA[parts[3]] ?? parts[3]}になった`, t.side);
        break;
      }
      case '-start': {
        // volatile状態の開始(のろい/やどりぎ/しおづけ/こんらん/ちいさくなる 等の汎用イベント)。
        const t = parseIdent(parts[2], ctx);
        const eff = (parts[3] ?? '').replace(/^move:\s*/, '').replace(/^ability:\s*/, '');
        push('status', `${t.name}に${moveJa(eff) || eff}の効果が始まった`, t.side);
        break;
      }
      case '-curestatus': {
        const t = parseIdent(parts[2], ctx);
        push('cure', `${t.name}の${STATUS_JA[parts[3]] ?? parts[3]}が治った`, t.side);
        break;
      }
      case '-weather': {
        const w = WEATHER_JA[parts[2]] ?? parts[2];
        if (parts.includes('[upkeep]')) break; // 継続表示はうるさいので省略
        const reason = fromReason(parts);
        push('weather', reason ? `天候が${w}になった` : `${w}が発生`, undefined);
        break;
      }
      case 'switch':
      case 'drag': {
        const t = parseIdent(parts[2], ctx);
        push('switch', `${t.side === 'self' ? '自分' : '相手'}が${t.name}に交代`, t.side);
        break;
      }
      case '-boost': {
        const t = parseIdent(parts[2], ctx);
        push('boost', `${t.name}の${STAT_JA[parts[3]] ?? parts[3]}が${parts[4]}段階上がった`, t.side);
        break;
      }
      case '-unboost': {
        const t = parseIdent(parts[2], ctx);
        push('boost', `${t.name}の${STAT_JA[parts[3]] ?? parts[3]}が${parts[4]}段階下がった`, t.side);
        break;
      }
      case '-enditem': {
        const t = parseIdent(parts[2], ctx);
        push('item', `${t.name}の${itemJa(parts[3])}が発動`, t.side);
        break;
      }
      case '-activate': {
        // "move: Protect"(まもる等)/"ability: ..."の両方がこのイベントを使う。
        // プレフィックスで技名/特性名の日本語辞書を出し分ける（技側はabilityJaでは引けないため）。
        const t = parseIdent(parts[2], ctx);
        const raw = parts[3] ?? '';
        const isMove = raw.startsWith('move:');
        const eff = raw.replace(/^ability:\s*/, '').replace(/^move:\s*/, '');
        const label = isMove ? moveJa(eff) || eff : abilityJa(eff) || eff;
        push('ability', `${t.name}: ${label}`, t.side);
        break;
      }
      case '-sidestart': {
        const side: 'self' | 'opp' = parts[2].startsWith('p1') ? 'self' : 'opp';
        const eff = (parts[3] ?? '').replace(/^move:\s*/, '');
        push('hazard', `${side === 'self' ? '自分側' : '相手側'}に${moveJa(eff)}を設置`, side);
        break;
      }
      case '-crit': {
        const t = parseIdent(parts[2], ctx);
        push('crit', `${t.name}に急所`, t.side);
        break;
      }
      case '-supereffective': {
        const t = parseIdent(parts[2], ctx);
        push('effectiveness', `${t.name}に効果は抜群`, t.side);
        break;
      }
      case '-resisted': {
        const t = parseIdent(parts[2], ctx);
        push('effectiveness', `${t.name}に効果はいまひとつ`, t.side);
        break;
      }
      case '-immune': {
        const t = parseIdent(parts[2], ctx);
        push('effectiveness', `${t.name}には効果がない`, t.side);
        break;
      }
      case '-miss': {
        const u = parseIdent(parts[2], ctx);
        push('miss', `${u.name}の攻撃は外れた`, u.side);
        break;
      }
      case 'cant': {
        const u = parseIdent(parts[2], ctx);
        const reason = CANT_REASON_JA[parts[3]] ?? `${parts[3]}で`;
        push('cant', `${u.name}は${reason}技を出せなかった`, u.side);
        break;
      }
      case 'upkeep':
        push('endturn', 'ターン終了', undefined);
        break;
      default:
        break; // debug/teampreview/gen/tier 等は無視
    }
  }
  return events;
}
