import { notFound } from "next/navigation";
import { CastingWizard } from "@/legacy/commercial/components/cast/casting-wizard";
import { CASTING_METHODS, type CastingMethod } from "@/domain/casting/types";

export default async function CastPage({ params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  if (!CASTING_METHODS.includes(method as CastingMethod)) notFound();
  return <CastingWizard method={method as CastingMethod} />;
}
