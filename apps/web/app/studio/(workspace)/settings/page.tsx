'use client';

import { SettingsSection, useStudio } from '../../studio-workspace';

export default function StudioSettingsPage() {
  const { runtime, user } = useStudio();
  if (!user) return null;
  return <SettingsSection runtime={runtime} user={user} />;
}
