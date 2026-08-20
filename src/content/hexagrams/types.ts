export type ZhHansSceneKind = "relationship" | "career" | "fortune";

export type ZhHansSceneModule = {
  kind: ZhHansSceneKind;
  heading: string;
  body: string;
};

export type ZhHansHexagramDetailContent = {
  number: number;
  theme: string;
  coreMeaning: string;
  practicalUnderstanding: string;
  supports: readonly [string, string];
  watchFor: readonly [string, string];
  unchanging: string;
  reflectionQuestions: readonly [string, string, string];
  lineNotes: readonly [string, string, string, string, string, string];
  sceneModule?: ZhHansSceneModule;
};
