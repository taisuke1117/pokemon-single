/**
 * 自パーティのDB永続化(保存済みパーティのライブラリ)。
 * @neondatabase/serverless(Neonのserverless PostgreSQLドライバ、`sql`タグ関数がrowsを直接返す)
 * を使い、1テーブル・JSONB丸ごと保存というシンプルな設計にしている(検索/JOIN不要なため)。
 */
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import type { PartyMemberSeed } from '../data/hydrate';

export interface PartyRecord {
  id: string;
  name: string;
  seeds: PartyMemberSeed[];
  createdAt: string;
  updatedAt: string;
}

export type PartySummary = Omit<PartyRecord, 'seeds'>;

interface PartyRow {
  id: string;
  name: string;
  seeds: PartyMemberSeed[];
  created_at: string;
  updated_at: string;
}

/**
 * 接続文字列が未設定の場合、@neondatabase/serverlessの生エラーは分かりにくいため、
 * ここで日本語の案内メッセージに変換する(Vercelダッシュボードでの設定手順を明示)。
 */
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URLが未設定です。Vercelダッシュボードの Storage タブから Neon(Postgres) をプロジェクトに接続してください。',
    );
  }
  return neon(url);
}

function mapRow(row: PartyRow): PartyRecord {
  return { id: row.id, name: row.name, seeds: row.seeds, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listParties(): Promise<PartySummary[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, created_at, updated_at FROM parties ORDER BY updated_at DESC
  `) as Omit<PartyRow, 'seeds'>[];
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function getParty(id: string): Promise<PartyRecord | null> {
  const sql = getSql();
  const rows = (await sql`SELECT * FROM parties WHERE id = ${id}`) as PartyRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createParty(name: string, seeds: PartyMemberSeed[]): Promise<PartyRecord> {
  const sql = getSql();
  const id = randomUUID();
  const rows = (await sql`
    INSERT INTO parties (id, name, seeds)
    VALUES (${id}, ${name}, ${JSON.stringify(seeds)}::jsonb)
    RETURNING *
  `) as PartyRow[];
  return mapRow(rows[0]);
}

export async function updateParty(
  id: string,
  patch: { name?: string; seeds?: PartyMemberSeed[] },
): Promise<PartyRecord | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE parties SET
      name = COALESCE(${patch.name ?? null}, name),
      seeds = COALESCE(${patch.seeds ? JSON.stringify(patch.seeds) : null}::jsonb, seeds),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as PartyRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteParty(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`DELETE FROM parties WHERE id = ${id} RETURNING id`) as { id: string }[];
  return rows.length > 0;
}
