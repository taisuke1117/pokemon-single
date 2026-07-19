/**
 * Neon(Vercel Postgres)への疎通確認。DATABASE_URLが正しく設定されていれば
 * `select 1`が通り、rowsが返る。
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URLが未設定です。.env.localを確認してください。');
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const rows = await sql`select 1 as ok`;
  console.log('接続OK:', rows);
}

main().catch((e) => {
  console.error('接続失敗:', e);
  process.exit(1);
});
