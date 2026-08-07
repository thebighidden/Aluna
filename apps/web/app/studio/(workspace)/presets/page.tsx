'use client';

import { useRouter } from 'next/navigation';
import { PresetsSection, useStudio } from '../../studio-workspace';

export default function StudioPresetsPage() {
  const router = useRouter();
  const { presets, changeCategory } = useStudio();
  return (
    <PresetsSection
      presets={presets}
      onUse={changeCategory}
      goCreate={() => router.push('/studio')}
    />
  );
}
