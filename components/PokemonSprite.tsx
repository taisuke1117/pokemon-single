'use client';

import { useState } from 'react';
import { getSpriteUrl } from '@/lib/data/sprite';
import { TYPE_COLORS, type PokeType } from '@/lib/types';

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 24, md: 32, lg: 48 };

export function PokemonSprite({
  species,
  name,
  types,
  size = 'md',
}: {
  /** dex互換の英語種族ID。undefinedなら常にプレースホルダー表示。 */
  species?: string;
  /** フォールバック表示用の頭文字元 */
  name: string;
  types?: PokeType[];
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const url = species ? getSpriteUrl(species) : undefined;
  const px = SIZE_PX[size];
  const color = types?.[0] ? TYPE_COLORS[types[0]] : '#4b5262';

  if (!url || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-sm border font-display font-bold"
        style={{
          width: px,
          height: px,
          borderColor: `${color}55`,
          backgroundColor: `${color}1a`,
          color,
          fontSize: px * 0.45,
        }}
      >
        {name.slice(0, 1)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={px}
      height={px}
      className="shrink-0 rounded-sm bg-hud-panelAlt object-contain"
      style={{ width: px, height: px, imageRendering: 'pixelated' }}
      onError={() => setFailed(true)}
    />
  );
}
