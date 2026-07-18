import { computeGameTheoryRecommendation } from '@/lib/engine/gt';
import type { BattleState, OpponentSlot, PartyMember } from '@/lib/types';

// @pkmn/sim はNode前提（Edgeランタイム不可）。ダメージ計算・シミュレーションを行うため nodejs 固定。
export const runtime = 'nodejs';
// 行列サンプリングに数秒かかりうる。
export const maxDuration = 30;

interface GtMatrixRequestBody {
  state: BattleState;
  bench: PartyMember[];
  opponents: OpponentSlot[];
  samples?: number;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as GtMatrixRequestBody;
    if (!body.state || !body.bench?.length || !body.opponents?.length) {
      return Response.json({ error: 'state / bench / opponents が必要です' }, { status: 400 });
    }
    const rec = computeGameTheoryRecommendation({
      state: body.state,
      bench: body.bench,
      opponents: body.opponents,
      samples: body.samples,
    });
    return Response.json(rec);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
