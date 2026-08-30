// Offline preview shape.
//
// The v1 deep reading types that used to live here (ReadingReport,
// ReadingVariant and the InterpretiveBasisReference carrying
// status: "pending_license") are gone. That status encoded an assumption the
// deep reading design has since dropped: the classical text is in the
// repository, verified against a fixed Wikisource revision, so a reading cites
// it for real rather than describing what a licensed renderer would fetch. The
// deep reading now returns commercial-reading-v2 — see
// src/domain/generation/schemas.ts and src/domain/generation/assemble-report.ts.
//
// The frozen v1 zod shape stays in schemas.ts as readingReportSchema; nothing
// produces it any more.

export type PreviewOutput = {
  relevanceStatement: string;
};
