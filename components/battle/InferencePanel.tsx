import { findNature, natureLabel } from '@/lib/data/nature-ja';
import { itemJa } from '@/lib/data/item-ja';
import type { EvBucket, OpponentInferenceSummary } from '@/lib/engine/infer';

const EV_BUCKET_LABEL: Record<EvBucket, string> = { low: '振り無し寄り', high: '振り有り寄り', unknown: '不明' };
const EV_BUCKET_CLASS: Record<EvBucket, string> = {
  low: 'text-hud-dim',
  high: 'text-hud-amber',
  unknown: 'text-hud-faint',
};

export function InferencePanel({ summary }: { summary: OpponentInferenceSummary | undefined }) {
  if (!summary) {
    return (
      <section className="border border-hud-line bg-hud-panel p-3">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">相手の型推定</h3>
        <p className="mt-1.5 text-[11px] text-hud-faint">相手の種族が未確定のため推定できません</p>
      </section>
    );
  }

  const allNarrowed = summary.natureCandidates.length < 25;

  return (
    <section className="flex flex-col gap-2 border border-hud-line bg-hud-panel p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-hud-faint">相手の型推定</h3>
        <span className="font-mono text-[9px] text-hud-dim">観測 {summary.observationCount}件</span>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-hud-faint">
          性格候補 {allNarrowed ? `（${summary.natureCandidates.length}種に絞り込み）` : '（未絞り込み）'}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {summary.natureCandidates.length >= 25 ? (
            <span className="text-[11px] text-hud-dim">まだ観測が無いか、絞り込めていません</span>
          ) : (
            summary.natureCandidates.map((id) => {
              const info = findNature(id);
              return (
                <span key={id} className="border border-hud-line bg-hud-panelAlt px-1.5 py-0.5 text-[10px] text-hud-text">
                  {info ? natureLabel(info) : id}
                </span>
              );
            })
          )}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-hud-faint">持ち物候補</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {summary.itemCandidates.map((id) => (
            <span key={id} className="border border-hud-line bg-hud-panelAlt px-1.5 py-0.5 text-[10px] text-hud-text">
              {id === 'none' ? 'なし' : itemJa(id)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-hud-faint">努力値の傾向（参考）</div>
        <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          <li className="flex items-center justify-between">
            <span className="text-hud-text">物理攻撃</span>
            <span className={EV_BUCKET_CLASS[summary.evEstimate.physicalAtk]}>{EV_BUCKET_LABEL[summary.evEstimate.physicalAtk]}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-hud-text">特殊攻撃</span>
            <span className={EV_BUCKET_CLASS[summary.evEstimate.specialAtk]}>{EV_BUCKET_LABEL[summary.evEstimate.specialAtk]}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-hud-text">物理耐久</span>
            <span className={EV_BUCKET_CLASS[summary.evEstimate.physicalBulk]}>{EV_BUCKET_LABEL[summary.evEstimate.physicalBulk]}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-hud-text">特殊耐久</span>
            <span className={EV_BUCKET_CLASS[summary.evEstimate.specialBulk]}>{EV_BUCKET_LABEL[summary.evEstimate.specialBulk]}</span>
          </li>
        </ul>
      </div>

      {summary.spreadConsistency.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-hud-faint">代表傾向との整合性</div>
          <ul className="mt-1 space-y-0.5">
            {summary.spreadConsistency.map((s) => (
              <li key={s.spreadName} className="flex items-center justify-between text-[11px]">
                <span className="text-hud-text">{s.spreadName}</span>
                <span className={s.consistent ? 'text-hud-cyan' : 'text-advantage-strongRisk'}>
                  {s.consistent ? '矛盾なし' : '矛盾あり'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.note && <p className="border-t border-hud-line pt-1.5 text-[10px] text-hud-amber">{summary.note}</p>}
    </section>
  );
}
