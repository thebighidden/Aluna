import { notFound } from 'next/navigation';
import AdminPage from '../page';
import { adminSections, type AdminSection } from '../sections';

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!adminSections.includes(section as AdminSection)) notFound();
  return <AdminPage />;
}
