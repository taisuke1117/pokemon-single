import { deleteParty, getParty, updateParty } from '@/lib/db/parties';
import type { PartyMemberSeed } from '@/lib/data/hydrate';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const party = await getParty(id);
    if (!party) return Response.json({ error: 'パーティが見つかりません' }, { status: 404 });
    return Response.json(party);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}

interface UpdatePartyBody {
  name?: string;
  seeds?: PartyMemberSeed[];
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const body = (await req.json()) as UpdatePartyBody;
    if (body.seeds !== undefined && body.seeds.length !== 6) {
      return Response.json({ error: 'seedsは6体分が必要です' }, { status: 400 });
    }
    const updated = await updateParty(id, { name: body.name?.trim(), seeds: body.seeds });
    if (!updated) return Response.json({ error: 'パーティが見つかりません' }, { status: 404 });
    return Response.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const ok = await deleteParty(id);
    if (!ok) return Response.json({ error: 'パーティが見つかりません' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
