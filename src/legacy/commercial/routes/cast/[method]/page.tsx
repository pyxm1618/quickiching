import { notFound } from "next/navigation";
import { CastingWizard } from "@/legacy/commercial/components/cast/casting-wizard";

const LEGACY_COMMERCIAL_METHODS = ["three_coin", "yarrow_stalk"] as const;
type LegacyCommercialMethod = (typeof LEGACY_COMMERCIAL_METHODS)[number];

export default async function CastPage({ params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  if (!LEGACY_COMMERCIAL_METHODS.includes(method as LegacyCommercialMethod)) notFound();
  return <CastingWizard method={method as LegacyCommercialMethod} />;
}
