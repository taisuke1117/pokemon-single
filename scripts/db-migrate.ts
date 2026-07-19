/**
 * scripts/db/schema.sql を実行してテーブルを作成する。CREATE TABLE IF NOT EXISTS のため
 * 何度実行しても安全。スキーマを変更したら schema.sql を編集し、このスクリプトを再実行する。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URLが未設定です。.env.localにVercel/Neonの接続文字列を設定してください。');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(join(__dirname, 'db/schema.sql'), 'utf-8');
// sql.query()は1回の呼び出しにつき1ステートメントが安全なため、ファイルをセミコロン区切りで分割する。
const statements = schema
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function main() {
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log(`スキーマを適用しました(${statements.length}文)。`);
}

main().catch((e) => {
  console.error('マイグレーション失敗:', e);
  process.exit(1);
});
