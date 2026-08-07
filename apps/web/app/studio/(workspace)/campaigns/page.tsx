'use client';

import { CampaignsSection, useStudio } from '../../studio-workspace';

export default function StudioCampaignsPage() {
  const { presets } = useStudio();
  return <CampaignsSection presets={presets} />;
}
