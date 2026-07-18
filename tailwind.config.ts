import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      colors: {
        advantage: {
          strong: '#1d4ed8',
          mild: '#3b6fd6',
          neutral: '#2a2f3a',
          mildRisk: '#c0463f',
          strongRisk: '#b91c1c',
        },
        hud: {
          bg: '#0b0d12',
          panel: '#12151c',
          panelAlt: '#171b24',
          raised: '#1b202b',
          line: '#242a36',
          cyan: '#22d3ee',
          amber: '#f5b041',
          text: '#e5e7eb',
          dim: '#7d8590',
          faint: '#4b5262',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 0 24px rgba(34,211,238,0.12)',
        amberGlow: '0 0 0 1px rgba(245,176,65,0.35), 0 0 28px rgba(245,176,65,0.15)',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        scan: 'scan 3.2s linear infinite',
        rise: 'rise 0.4s ease-out both',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
