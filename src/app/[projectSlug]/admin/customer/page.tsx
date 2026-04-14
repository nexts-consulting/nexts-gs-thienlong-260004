import { notFound } from "next/navigation";
import { getProjectConfig } from "@/config/projects";
import AdminCustomerPage from "@/app/admin/customer/components/admin-customer";

interface Props {
  params: Promise<{ projectSlug: string }>;
}

export default async function AdminPage({ params }: Props) {
  const { projectSlug } = await params;
  const projectConfig = getProjectConfig(projectSlug);

  if (!projectConfig) {
    notFound();
  }

  return <AdminCustomerPage projectConfig={projectConfig} />;
}
