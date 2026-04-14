import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProjectConfig } from "@/config/projects";
import { Entry } from "@/app/client-app/redeem/components/entry";

interface Props {
  params: Promise<{ projectSlug: string }>;
}

export default async function RedeemPage({ params }: Props) {
  const { projectSlug } = await params;
  const projectConfig = getProjectConfig(projectSlug);

  if (!projectConfig) {
    notFound();
  }

  return (
    <Suspense>
      <Entry projectConfig={projectConfig} />
    </Suspense>
  );
}
