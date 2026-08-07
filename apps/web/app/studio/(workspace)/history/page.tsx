'use client';

import { HistorySection, useStudio } from '../../studio-workspace';

export default function StudioHistoryPage() {
  const { generations } = useStudio();
  return <HistorySection generations={generations} />;
}
