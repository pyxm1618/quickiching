export type ZhSeoResearchStatus = "VERIFIED" | "UNVERIFIED";

export type ZhDensityProfile = "hub" | "portal" | "tool" | "guide";

export const ZH_DENSITY_PROFILES: Record<
  ZhDensityProfile,
  {
    primaryMin: number;
    primaryMax: number;
    familyMin: number;
    familyMax: number;
    description: string;
  }
> = {
  hub: {
    primaryMin: 0.1,
    primaryMax: 0.8,
    familyMin: 0.2,
    familyMax: 2.0,
    description: "64卦全景索引与聚合导航页",
  },
  portal: {
    primaryMin: 0.8,
    primaryMax: 2.0,
    familyMin: 2.0,
    familyMax: 5.0,
    description: "中文主站门户与综合入口",
  },
  tool: {
    primaryMin: 0.4,
    primaryMax: 2.5,
    familyMin: 1.5,
    familyMax: 10.0,
    description: "特定起卦流程工具交互与操作指引",
  },
  guide: {
    primaryMin: 0.5,
    primaryMax: 2.0,
    familyMin: 1.0,
    familyMax: 11.0,
    description: "易经义理深度解释与研读指南",
  },
};

export type ZhSeoPageDefinition = {
  routeId: string;
  canonicalUrl: string;
  densityProfile: ZhDensityProfile;
  searchIntent: string;
  primaryKeyword: string;
  secondaryCore: readonly string[];
  secondaryVariantFamily: readonly string[];
  semanticEntityTerms: readonly string[];
  finalTitle: string;
  finalDescription: string;
  finalH1: string;
  requiredPlacement: readonly ("title" | "description" | "h1" | "early-copy" | "h2" | "inbound-anchor")[];
  primaryDensityMin: number;
  primaryDensityMax: number;
  familyDensityMin: number;
  familyDensityMax: number;
  researchEvidence: readonly string[];
  sourceNotes: string;
  researchStatus: ZhSeoResearchStatus;
};

export const ZH_INDEXABLE_PAGE_SEO = {
  homepage: {
    routeId: "homepage",
    canonicalUrl: "/zh",
    densityProfile: "portal",
    searchIntent: "在线完成易经起卦，并理解本卦、动爻和变卦",
    primaryKeyword: "易经在线起卦",
    secondaryCore: ["周易在线起卦", "易经起卦", "在线起卦"],
    secondaryVariantFamily: ["三枚铜钱起卦", "蓍草起卦", "梅花易数起卦", "手动起卦"],
    semanticEntityTerms: ["易经", "周易", "六十四卦", "本卦", "动爻", "变卦", "之卦"],
    finalTitle: "易经在线起卦｜四种起卦方法与六十四卦解读 | Quick I Ching",
    finalDescription: "使用易经在线起卦：可选三枚铜钱、蓍草、梅花易数或手动起卦，查看本卦、动爻、变卦与六十四卦中文说明。",
    finalH1: "易经在线起卦：从起卦到本卦、动爻与变卦",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2"],
    primaryDensityMin: 0.8,
    primaryDensityMax: 2.0,
    familyDensityMin: 2.0,
    familyDensityMax: 5.0,
    researchEvidence: ["https://gaodaoyijing.com/yijing-online-qigua/"],
    sourceNotes: "当前中文 SERP 可验证“易经在线起卦”作为工具型搜索意图。Semrush API units 不足，Search Volume/KD/Competition 均未取得，不填猜测值。",
    researchStatus: "UNVERIFIED",
  },
  "three-coin-method": {
    routeId: "three-coin-method",
    canonicalUrl: "/zh/methods/three-coin",
    densityProfile: "tool",
    searchIntent: "学习并在线完成三枚铜钱起卦",
    primaryKeyword: "三枚铜钱起卦",
    secondaryCore: ["铜钱起卦", "三枚铜钱法", "易经铜钱起卦"],
    secondaryVariantFamily: ["三枚硬币起卦", "铜钱法", "六次掷币", "动爻"],
    semanticEntityTerms: ["6", "7", "8", "9", "阴爻", "阳爻", "本卦", "变卦"],
    finalTitle: "三枚铜钱起卦｜在线六次掷币生成易经卦象 | Quick I Ching",
    finalDescription: "在线使用三枚铜钱起卦：连续六次掷币，自下而上生成六爻，识别动爻，并查看本卦与变卦的中文解读。",
    finalH1: "三枚铜钱起卦：在线完成六次掷币",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 1.0,
    primaryDensityMax: 2.0,
    familyDensityMin: 3.0,
    familyDensityMax: 5.0,
    researchEvidence: ["https://iching-bazi-fengshui.com/zh-CN/iching/coin-method/", "https://fatefolio.com/zh/wiki/coin-method"],
    sourceNotes: "当前中文 SERP 明确使用“三枚铜钱起卦/铜钱起卦”。Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "yarrow-stalks-method": {
    routeId: "yarrow-stalks-method",
    canonicalUrl: "/zh/methods/yarrow-stalks",
    densityProfile: "tool",
    searchIntent: "了解蓍草筮法并在线完成十八变",
    primaryKeyword: "蓍草起卦",
    secondaryCore: ["蓍草法", "蓍草筮法", "大衍筮法"],
    secondaryVariantFamily: ["四十九根蓍草", "三变成爻", "十八变成卦", "蓍草占筮"],
    semanticEntityTerms: ["大衍之数", "四十九", "揲四", "归奇", "六爻", "周易"],
    finalTitle: "蓍草起卦｜49蓍草十八变在线筮法 | Quick I Ching",
    finalDescription: "在线体验蓍草起卦：按49蓍草的三变成爻、十八变成卦流程记录每一步计算，最终查看动爻、本卦与变卦。",
    finalH1: "蓍草起卦：49蓍草十八变在线流程",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 1.0,
    primaryDensityMax: 2.5,
    familyDensityMin: 1.5,
    familyDensityMax: 5.0,
    researchEvidence: ["https://fatefolio.com/wiki/yarrow-method", "https://www.tup.tsinghua.edu.cn/bookscenter/bookcatalog?id=08009401"],
    sourceNotes: "当前公开资料与搜索结果稳定使用“蓍草起卦/蓍草起卦法”。Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "mei-hua-yi-shu": {
    routeId: "mei-hua-yi-shu",
    canonicalUrl: "/zh/methods/mei-hua-yi-shu",
    densityProfile: "tool",
    searchIntent: "使用时间或数字理解并完成梅花易数起卦",
    primaryKeyword: "梅花易数起卦",
    secondaryCore: ["梅花易数", "梅花易数时间起卦", "梅花易数怎么起卦"],
    secondaryVariantFamily: ["时间起卦", "数字起卦", "上卦", "下卦", "动爻"],
    semanticEntityTerms: ["邵雍", "体用", "八卦", "十二时辰", "公历时间约定"],
    finalTitle: "梅花易数起卦｜在线时间起卦与计算说明 | Quick I Ching",
    finalDescription: "使用梅花易数起卦的公历时间约定，固定时区与当前时刻，查看上卦、下卦、动爻、本卦和变卦，并复核计算过程。",
    finalH1: "梅花易数起卦：按公历当前时间在线起卦",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 0.4,
    primaryDensityMax: 2.0,
    familyDensityMin: 2.5,
    familyDensityMax: 5.0,
    researchEvidence: ["https://tianjige.club/meihua/qigua", "https://wenmingshu.com/insights/meihua-qigua", "https://meihua.quan77.cn/"],
    sourceNotes: "当前中文 SERP 大量直接使用“梅花易数起卦/梅花易数怎么起卦”。Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "manual-cast-method": {
    routeId: "manual-cast-method",
    canonicalUrl: "/zh/methods/manual-cast",
    densityProfile: "tool",
    searchIntent: "已有六爻值或本卦时手动输入并生成变卦",
    primaryKeyword: "手动起卦",
    secondaryCore: ["易经手动起卦", "六爻手动起卦", "手动输入卦象"],
    secondaryVariantFamily: ["六爻值", "本卦", "动爻", "变卦", "指定动爻"],
    semanticEntityTerms: ["老阴", "少阳", "少阴", "老阳", "6", "7", "8", "9"],
    finalTitle: "手动起卦｜输入六爻值或本卦动爻 | Quick I Ching",
    finalDescription: "手动起卦工具：直接输入六个爻值，或选择本卦与动爻位置，不使用随机数，即时生成本卦、动爻与变卦。",
    finalH1: "手动起卦：输入六爻值或选择本卦与动爻",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 1.0,
    primaryDensityMax: 2.5,
    familyDensityMin: 3.0,
    familyDensityMax: 10.0,
    researchEvidence: ["https://github.com/fengzhongsikao/windnote", "https://xungufa.com/liuyao/"],
    sourceNotes: "当前工具型结果中存在“手动起卦”这一明确功能表达，但 Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "guides-how-to-ask": {
    routeId: "guides-how-to-ask",
    canonicalUrl: "/zh/guides/how-to-ask-the-i-ching",
    densityProfile: "guide",
    searchIntent: "学习易经问卦时如何把问题问清楚",
    primaryKeyword: "易经怎么问",
    secondaryCore: ["易经问卦", "问卦怎么问", "易经提问"],
    secondaryVariantFamily: ["一事一问", "问题怎么问", "重复问卦", "是否问题"],
    semanticEntityTerms: ["蒙卦", "初筮告", "反思", "决策边界"],
    finalTitle: "易经怎么问｜问卦问题写法与常见误区 | Quick I Ching",
    finalDescription: "易经怎么问才清楚？用一事一问、可观察的处境和明确时间范围整理问题，并了解是否题、重复问卦与高风险决策的边界。",
    finalH1: "易经怎么问：把问题问清楚的实用指南",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 0.5,
    primaryDensityMax: 2.0,
    familyDensityMin: 1.0,
    familyDensityMax: 5.0,
    researchEvidence: ["https://www.xuanjige.app/articles/asking-and-judging"],
    sourceNotes: "SERP 可验证“问卦怎么问/问卦与断卦”意图，但 exact keyword 的 Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "guides-changing-lines": {
    routeId: "guides-changing-lines",
    canonicalUrl: "/zh/guides/changing-lines",
    densityProfile: "guide",
    searchIntent: "理解易经动爻、变爻以及6/9如何生成变卦",
    primaryKeyword: "易经动爻",
    secondaryCore: ["动爻", "变爻", "易经变爻"],
    secondaryVariantFamily: ["老阴", "老阳", "变卦", "爻位", "多个动爻"],
    semanticEntityTerms: ["6", "7", "8", "9", "阴阳变化", "本卦", "变卦"],
    finalTitle: "易经动爻｜变爻怎么看与变卦怎么生成 | Quick I Ching",
    finalDescription: "理解易经动爻：为什么6与9会变化、动爻如何生成变卦，以及没有、一个或多个动爻时怎样按结构阅读。",
    finalH1: "易经动爻：变爻怎么看、变卦怎么生成",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 0.8,
    primaryDensityMax: 2.0,
    familyDensityMin: 3.0,
    familyDensityMax: 7.0,
    researchEvidence: ["https://fatefolio.com/zh/wiki/moving-line", "https://gaodaoyijing.com/bianyao-zenme-kan/"],
    sourceNotes: "当前中文 SERP 对“动爻/变爻怎么看”意图明确。Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "guides-primary-relating": {
    routeId: "guides-primary-relating",
    canonicalUrl: "/zh/guides/primary-relating-hexagrams",
    densityProfile: "guide",
    searchIntent: "理解本卦、动爻与变卦之间的结构关系",
    primaryKeyword: "本卦变卦",
    secondaryCore: ["本卦", "变卦", "之卦"],
    secondaryVariantFamily: ["本卦和变卦", "动爻", "卦象变化", "主卦"],
    semanticEntityTerms: ["六爻", "阴阳翻转", "原始结构", "变化后的结构"],
    finalTitle: "本卦变卦｜本卦、动爻与之卦怎么理解 | Quick I Ching",
    finalDescription: "理解本卦变卦的关系：本卦表示原始六爻结构，动爻连接变化，变卦（本站称之卦）是实际动爻翻转后的结构。",
    finalH1: "本卦变卦：本卦、动爻与之卦的关系",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 0.8,
    primaryDensityMax: 2.0,
    familyDensityMin: 3.0,
    familyDensityMax: 11.0,
    researchEvidence: ["https://gaodaoyijing.com/bianyao-zenme-kan/", "https://ctext.org/wiki.pl?chapter=699485&if=gb&remap=gb"],
    sourceNotes: "中文内容普遍使用“本卦/变卦/动爻”；项目术语统一把 relating hexagram 称为“之卦”，并在首次出现时解释“之卦（变卦）”。Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
  "hexagrams-hub": {
    routeId: "hexagrams-hub",
    canonicalUrl: "/zh/hexagrams",
    densityProfile: "hub",
    searchIntent: "按文王卦序浏览易经六十四卦并进入每一卦详情",
    primaryKeyword: "易经六十四卦",
    secondaryCore: ["周易六十四卦", "六十四卦", "易经64卦"],
    secondaryVariantFamily: ["六十四卦卦序", "卦辞", "爻辞", "卦象"],
    semanticEntityTerms: ["文王卦序", "八卦", "384爻", "卦辞", "大象"],
    finalTitle: "易经六十四卦｜64卦卦序与中文卦象详情 | Quick I Ching",
    finalDescription: "按文王卦序浏览易经六十四卦，进入64个中文卦象详情页，查看卦辞、大象、六爻原文、结构说明与现实反思。",
    finalH1: "易经六十四卦：64卦卦序与中文详情",
    requiredPlacement: ["title", "description", "h1", "early-copy", "h2", "inbound-anchor"],
    primaryDensityMin: 0.1,
    primaryDensityMax: 0.8,
    familyDensityMin: 0.2,
    familyDensityMax: 2.0,
    researchEvidence: ["https://bazi-atlas.com/zh/hexagrams", "https://zh.wikisource.org/zh-hans/%E5%91%A8%E6%98%93"],
    sourceNotes: "当前中文 SERP 与经典资料稳定使用“易经六十四卦/周易六十四卦”。Search Volume/KD 未验证。",
    researchStatus: "UNVERIFIED",
  },
} as const satisfies Record<string, ZhSeoPageDefinition>;

export type ZhSeoRouteId = keyof typeof ZH_INDEXABLE_PAGE_SEO;

export function zhSeoFor(routeId: ZhSeoRouteId): ZhSeoPageDefinition {
  return ZH_INDEXABLE_PAGE_SEO[routeId];
}
