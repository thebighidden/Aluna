'use client';

import { BrandProfileSection } from '../../brand-profile-section';
import { useStudio } from '../../studio-workspace';

export default function StudioBrandPage() {
  const { user } = useStudio();
  return <BrandProfileSection fallbackName={user?.name ?? 'My brand'} />;
}
