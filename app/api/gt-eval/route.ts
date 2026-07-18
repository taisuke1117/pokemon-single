import { computeCurrentEvaluation } from '@/lib/engine/gt';
import type { BattleState, OpponentSlot, PartyMember } from '@/lib/types';

// @pkmn/sim はNode前提（Edgeランタイム不可）。
export const runtime = 'nodejs';

interface GtEvalRequestBody {
  state: BattleState;
  bench: PartyMember[];
  opponents: OpponentSlot[];
}

/** 行列計算(サンプリング)を伴わない、現在の盤面の評価値のみを返す軽量エンドポイント。 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as GtEvalRequestBody;
    if (!body.state || !body.bench?.length || !body.opponents?.length) {
      return Response.json({ error: 'state / bench / opponents が必要です' }, { status: 400 });
    }
    const result = computeCurrentEvaluation({
      state: body.state,
      bench: body.bench,
      opponents: body.opponents,
    });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
