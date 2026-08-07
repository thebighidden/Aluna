'use client';

import { useParams } from 'next/navigation';
import { CampaignDetailSection } from '../../../studio-workspace';

export default function StudioCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  return <CampaignDetailSection key={params.id} id={params.id} />;
}
