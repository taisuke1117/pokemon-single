import { computeSelectionRecommendation } from '@/lib/engine/gt/selection';
import type { OpponentSlot, PartyMember } from '@/lib/types';

// @pkmn/sim はNode前提（Edgeランタイム不可）。
export const runtime = 'nodejs';
export const maxDuration = 30;

interface GtSelectionRequestBody {
  party: PartyMember[];
  opponents: OpponentSlot[];
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as GtSelectionRequestBody;
    if (!body.party?.length || !body.opponents?.length) {
      return Response.json({ error: 'party / opponents が必要です' }, { status: 400 });
    }
    const rec = computeSelectionRecommendation(body.party, body.opponents);
    return Response.json(rec);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
