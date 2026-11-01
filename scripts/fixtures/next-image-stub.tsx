import React from "react";

export default function FixtureImage({
  src,
  alt = "",
  fill: _fill,
  priority: _priority,
  quality: _quality,
  unoptimized: _unoptimized,
  ...props
}: {
  src: string | { src?: string };
  alt?: string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  [key: string]: unknown;
}) {
  const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";
  return React.createElement("img", { ...props, src: resolvedSrc, alt });
}
