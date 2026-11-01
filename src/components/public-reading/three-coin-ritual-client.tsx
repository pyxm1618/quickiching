"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { ThreeCoinRitual } from "@/components/public-reading/three-coin-ritual";

const DynamicTool = dynamic(
  () => import("@/components/public-reading/three-coin-tool").then((m) => m.ThreeCoinTool),
  { ssr: false }
);

export function ThreeCoinRitualClient(
  props: Omit<ComponentProps<typeof ThreeCoinRitual>, "children">
) {
  return (
    <ThreeCoinRitual {...props}>
      <DynamicTool dictionary={props.dictionary} />
    </ThreeCoinRitual>
  );
}
