import React from "react";

export default function FixtureImage({
  src,
  alt = "",
  fill: _fill,
  priority: _priority,
  quality: _quality,
  unoptimized: _unoptimized,
  ...props
}) {
  const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";
  return React.createElement("img", { ...props, src: resolvedSrc, alt });
}
