'use client';

import { CreateSection, useStudio } from '../studio-workspace';

export default function StudioCreatePage() {
  const { createProps } = useStudio();
  return <CreateSection {...createProps} />;
}
