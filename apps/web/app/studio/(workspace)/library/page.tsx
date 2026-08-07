'use client';

import { LibrarySection, useStudio } from '../../studio-workspace';

export default function StudioLibraryPage() {
  const { generations, assetUrls, downloadResult } = useStudio();
  return (
    <LibrarySection
      generations={generations}
      assetUrls={assetUrls}
      onDownload={downloadResult}
    />
  );
}
