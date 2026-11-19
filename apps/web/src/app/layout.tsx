import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Coding Agent Comparator',
  description: 'Send one task to several coding agents and watch how each one handles it.',
};

/**
 * Light or dark follows the system's setting (docs/design/look-and-feel.md): the theme switches on the `dark`
 * class, set before the first paint and kept in step when the setting changes.
 */
const FOLLOW_SYSTEM_THEME = `(() => {
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', dark.matches);
  apply();
  dark.addEventListener('change', apply);
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOLLOW_SYSTEM_THEME }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
