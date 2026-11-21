import { ImageResponse } from 'next/og';

// The picture a link to the app is shown with, in a chat or a mail: the slope, what the app does, who made it.
export const alt = 'Same slope, two agents. A comparator of coding agents, made by Stéphane Pires.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The dark theme's colours, written out: this picture is drawn outside the page and its stylesheet.
const BACKGROUND = '#0a0a0a';
const MUTED = '#262626';
const TEXT = '#fafafa';
const QUIET = '#a1a1a1';
const BRAND = '#f39ac8';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        background: BACKGROUND,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
        <svg width="480" height="240" viewBox="0 0 240 120">
          <path fill={MUTED} d="M0 120V96L84 30Q120 14 150 34L240 86V120Z" />
          <g stroke={BRAND} fill="none" strokeWidth="3" strokeLinecap="round">
            <path d="M106 34C84 48 124 60 100 78S56 102 66 120" />
            <path d="M134 34C112 48 152 60 128 78S84 102 94 120" />
          </g>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>Same slope,</div>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>two agents.</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 30, color: QUIET, maxWidth: 720 }}>
          Send one task to Claude Code and Codex, and watch their runs side by side.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 30 }}>
          Made by Stéphane Pires
          <svg width="30" height="30" viewBox="0 0 24 24">
            <path
              fill={BRAND}
              d="M12 21s-7.5-4.6-9.7-9.3C.8 8.300 2.700 4.500 6.300 4.500c2.100 0 3.700 1.100 4.700 2.700h2c1-1.600 2.600-2.700 4.700-2.700 3.600 0 5.500 3.800 4 7.200C19.500 16.400 12 21 12 21Z"
            />
          </svg>
        </div>
      </div>
    </div>,
    size,
  );
}
