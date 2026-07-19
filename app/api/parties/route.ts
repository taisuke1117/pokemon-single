import { createParty, listParties } from '@/lib/db/parties';
import type { PartyMemberSeed } from '@/lib/data/hydrate';

// pgドライバ(@neondatabase/serverless)使用のためEdgeランタイム不可。
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    return Response.json({ parties: await listParties() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}

interface CreatePartyBody {
  name: string;
  seeds: PartyMemberSeed[];
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as CreatePartyBody;
    if (!body.name?.trim() || body.seeds?.length !== 6) {
      return Response.json({ error: 'name と 6体分の seeds が必要です' }, { status: 400 });
    }
    const created = await createParty(body.name.trim(), body.seeds);
    return Response.json(created);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
