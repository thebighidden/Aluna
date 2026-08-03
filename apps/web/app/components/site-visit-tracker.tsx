'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { API_BASE_URL } from '../lib/auth-client';

const visitorKey = 'aluna-visitor-id';

function visitorId(): string {
  const existing = window.localStorage.getItem(visitorKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(visitorKey, created);
  return created;
}

export function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const controller = new AbortController();
    const query = window.location.search.slice(0, 300);
    void fetch(`${API_BASE_URL}/analytics/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: `${pathname}${query}`,
        visitorId: visitorId(),
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  return null;
}
