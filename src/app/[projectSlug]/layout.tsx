import { notFound } from "next/navigation";
import { getProjectConfig, VALID_PROJECT_SLUGS } from "@/config/projects";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectSlug: string }>;
}

export function generateStaticParams() {
  return VALID_PROJECT_SLUGS.map((slug) => ({ projectSlug: slug }));
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectSlug } = await params;
  const config = getProjectConfig(projectSlug);

  if (!config) {
    notFound();
  }

  return <>{children}</>;
}
