import { GoogleGenAI, Type } from '@google/genai';
import type { MatchupCell, OpponentSlot, PartyMember, SelectionPick } from '@/lib/types';

export const runtime = 'nodejs';

interface ExplainRequestBody {
  party: PartyMember[];
  opponents: OpponentSlot[];
  matrix: Record<string, Record<string, MatchupCell>>;
  /** lib/engine/rank.ts が既に決定した選出3匹（役割込み）。Geminiは理由文だけを書き直す。 */
  picks: SelectionPick[];
  warnings: string[];
}

function speedLabel(speed: MatchupCell['speed']): string {
  return speed === 'win' ? '先手' : speed === 'lose' ? '後手' : '同速';
}

/**
 * 決定的なエンジン出力(選出・数値)をそのままプロンプトに埋め込み、
 * Geminiには「計算」ではなく「言語化」だけを担わせる。
 */
function primarySpreadLabel(o: OpponentSlot): string {
  if (!o.spreads?.length) return '';
  const primary = [...o.spreads].sort((a, b) => b.prob - a.prob)[0];
  return `${primary.item}/${primary.ability}`;
}

function buildPrompt(body: ExplainRequestBody): string {
  const resolvedOpponents = body.opponents.filter((o) => o.resolvedName);

  const pickLines = body.picks
    .map((p) => {
      const member = body.party.find((m) => m.id === p.memberId);
      if (!member) return null;
      const vsLines = resolvedOpponents
        .map((o) => {
          const cell = body.matrix[p.memberId]?.[o.id];
          if (!cell) return null;
          const rankText = o.rank ? `${o.rank}位` : '順位不明';
          return `    - 対${o.resolvedName}（${primarySpreadLabel(o)}, 使用率ランキング${rankText}・${o.confirmed ? '型確定' : '型推定'}）: 与ダメ${cell.atkRange}(${cell.atkKo}) / 被ダメ${cell.defRange}(${cell.defKo}) / 素早さ${speedLabel(cell.speed)} / 総合判定${cell.verdict}`;
        })
        .filter(Boolean)
        .join('\n');
      return `- id:"${member.id}" ${member.name}（${p.role}） タイプ:${member.types.join('/')} 持ち物:${member.item} 特性:${member.ability}\n${vsLines}`;
    })
    .filter(Boolean)
    .join('\n');

  const warningLines = body.warnings.map((w) => `- ${w}`).join('\n');

  return `あなたはポケモン対戦（ポケモンチャンピオンズ、シングルバトル）の選出補佐AIです。

以下は、決定的なダメージ計算エンジンによって既に算出済みの「選出3匹とその役割」、および各匹の相手ごとの相性データです。選出そのものはロジック側で確定済みのため、あなたが選出や役割を変更することはできません。

${pickLines}

既存の全体所見:
${warningLines || '(なし)'}

# タスク
各ポケモンについて、上記データを根拠に「採用理由」(reasons: 2〜3個)と「警戒点」(watchOut: 1〜2個)を書いてください。

重要な指示:
- 「○○%取れる」「○○%の被弾を受ける」のように数値をそのまま読み上げるだけの言い回しは禁止です。数値は根拠として使いつつ、それが対戦の流れの中で何を意味するか（後続への負担を減らせる、後出しから崩せる、居座られると詰みかねない、持ち物/特性がどう影響するか等）を中心に書いてください。
- 持ち物・特性・技のニュアンスを積極的に活用してください（例:「こだわりスカーフ持ちの◯◯が相手にいるため後出しは避けたい」等）。
- 同じ文型・言い回しの繰り返しを避け、各項目で違う切り口から書いてください。
- 数値の再計算はせず、与えられた数値と役割分担を変更・創作しないでください（新しい数値やこちらが示していない技/持ち物を創作しないこと）。
- 全体所見(warnings)も同じデータを踏まえて、対戦の組み立て方に関する実戦的なアドバイスとして書き直してください（1〜3個）。
- 出力は指定されたJSON形式のみとし、前置きや補足文は一切含めないでください。
- 各pickのmemberIdには、上記で示した id:"..." の文字列をそのまま（改変せず）使用してください。ポケモンの名前をmemberIdにしないでください。`;
}

interface GeminiExplainResult {
  picks: { memberId: string; reasons: string[]; watchOut: string[] }[];
  warnings: string[];
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY が設定されていません（.env.local を確認してください）' }, { status: 500 });
  }

  let body: ExplainRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  if (!body.picks?.length) {
    return Response.json({ error: '選出データがありません' }, { status: 400 });
  }

  const prompt = buildPrompt(body);
  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            picks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  memberId: { type: Type.STRING },
                  reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  watchOut: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['memberId', 'reasons', 'watchOut'],
              },
            },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['picks', 'warnings'],
        },
      },
    });
    text = result.text;
  } catch (e) {
    return Response.json({ error: `Gemini呼び出しに失敗しました: ${String(e)}` }, { status: 502 });
  }

  if (!text) {
    return Response.json({ error: 'Geminiからの応答が空でした' }, { status: 502 });
  }

  let parsed: GeminiExplainResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Geminiの応答をJSONとして解釈できませんでした' }, { status: 502 });
  }

  // memberId が一致しない場合（LLMがidを改変した等）は、同じ並び順である前提で位置合わせにフォールバックする
  const byIdMatches = body.picks.every((p) => parsed.picks.some((e) => e.memberId === p.memberId));
  const mergedPicks: SelectionPick[] = body.picks.map((p, i) => {
    const enriched = byIdMatches
      ? parsed.picks.find((e) => e.memberId === p.memberId)
      : parsed.picks[i];
    return enriched ? { ...p, reasons: enriched.reasons, watchOut: enriched.watchOut } : p;
  });

  return Response.json({ picks: mergedPicks, warnings: parsed.warnings });
}
