'use client';

import { useEffect, useState } from 'react';
import { usePartyStore } from '@/store/party-store';
import type { PartyMemberSeed } from '@/lib/data/hydrate';

interface PartySummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface PartyRecord extends PartySummary {
  seeds: PartyMemberSeed[];
}

type Status = 'idle' | 'loading' | 'error';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * PartyEditorのモーダル(z-50)の上に重ねる子モーダル。保存済みパーティの一覧・読込・削除。
 */
export function SavedPartiesModal({ onClose }: { onClose: () => void }) {
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const loadSeeds = usePartyStore((s) => s.loadSeeds);

  async function fetchList() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/parties');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setParties(data.parties as PartySummary[]);
      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  async function handleLoad(summary: PartySummary) {
    if (!window.confirm(`「${summary.name}」を読み込みます。現在編集中の内容は破棄されます。よろしいですか？`)) return;
    setPendingId(summary.id);
    try {
      const res = await fetch(`/api/parties/${summary.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const record = data as PartyRecord;
      loadSeeds(record.seeds, { id: record.id, name: record.name });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(summary: PartySummary) {
    if (!window.confirm(`「${summary.name}」を削除します。元に戻せません。よろしいですか？`)) return;
    setPendingId(summary.id);
    try {
      const res = await fetch(`/api/parties/${summary.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col border border-hud-line bg-hud-panel shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hud-line px-4 py-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-hud-text">
            保存済みパーティ
          </h3>
          <button type="button" onClick={onClose} className="font-mono text-xs text-hud-dim hover:text-hud-text">
            閉じる ✕
          </button>
        </header>

        <div className="overflow-y-auto p-3">
          {status === 'loading' && <p className="font-mono text-[11px] text-hud-cyan">読み込み中…</p>}
          {status === 'error' && (
            <div className="space-y-2">
              <p className="font-mono text-[11px] text-advantage-mildRisk">エラー: {error}</p>
              <button
                type="button"
                onClick={fetchList}
                className="rounded-sm border border-hud-line bg-hud-panelAlt px-3 py-1 font-mono text-[10px] text-hud-text hover:bg-hud-panel"
              >
                再試行
              </button>
            </div>
          )}
          {status === 'idle' && parties.length === 0 && (
            <p className="text-[11px] text-hud-faint">保存済みのパーティはまだありません。</p>
          )}
          {status === 'idle' && parties.length > 0 && (
            <ul className="space-y-1">
              {parties.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 border border-hud-line bg-hud-panelAlt px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] text-hud-text">{p.name}</div>
                    <div className="font-mono text-[9px] text-hud-faint">更新: {formatDate(p.updatedAt)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleLoad(p)}
                      disabled={pendingId === p.id}
                      className="rounded-sm border border-hud-cyan/50 bg-hud-cyan/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-hud-cyan transition hover:bg-hud-cyan/20 disabled:opacity-40"
                    >
                      読み込む
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={pendingId === p.id}
                      className="rounded-sm border border-hud-line px-2 py-1 font-mono text-[10px] text-hud-faint transition hover:border-advantage-mildRisk/50 hover:text-advantage-mildRisk disabled:opacity-40"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
