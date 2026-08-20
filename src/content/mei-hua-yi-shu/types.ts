export type LocalizedHexagramContent = {
  displayName: string;
  theme: string;
  coreMeaning: string;
  judgment: string;
  image: string;
};

export type LocalizedReadingContent = {
  hexagrams: Readonly<Record<number, LocalizedHexagramContent>>;
  linePositionHints: readonly [string, string, string, string, string, string];
  activeLine: {
    oldYin: string;
    oldYang: string;
    yinToYang: string;
    yangToYin: string;
    originalExplanationTemplate: string;
    oldYinCaution: string;
    oldYangCaution: string;
    reflectionTemplate: string;
  };
  messages: {
    noChangingLines: string;
    changingLines: string;
    directionWithRelating: string;
    directionWithoutRelating: string;
    supports: readonly [string, string, string];
    cautions: readonly [string, string, string];
    reflections: readonly [string, string, string];
    whereChangeNone: string;
    whereChangeSome: string;
    bottomWithRelating: string;
    bottomNoRelating: string;
  };
};

export type MeiHuaPageContent = {
  locale: "zh-Hans";
  metadata: {
    title: string;
    description: string;
  };
  eyebrow: string;
  h1: string;
  introduction: string;
  positioning: {
    heading: string;
    paragraphs: readonly string[];
  };
  scope: {
    supported: readonly string[];
    notSupported: readonly string[];
  };
  convention: {
    heading: string;
    paragraphs: readonly string[];
    bullets: readonly string[];
  };
  interpretation: {
    heading: string;
    paragraphs: readonly string[];
  };
  navigation: {
    hexagrams: string;
    changingLines: string;
    home: string;
  };
  reading: LocalizedReadingContent;
};
