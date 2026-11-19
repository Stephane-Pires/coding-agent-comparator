import type { Metadata } from 'next';

import { NotFoundPage } from '../errors/error-page.tsx';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return <NotFoundPage />;
}
