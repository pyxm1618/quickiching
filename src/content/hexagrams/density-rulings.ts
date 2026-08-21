import type { ContentLocale } from "@/i18n/config";

export type DensityReviewBand = "below-3%" | "above-5%";

export type DensityReviewRuling = {
  locale: ContentLocale;
  number: number;
  expectedBand: DensityReviewBand;
  rationale: string;
  reviewedBy: "content-review-v1";
};

/**
 * Page-scoped editorial decisions for the current production HTML audit.
 *
 * This is intentionally not a locale-wide or content-class allowlist. A page
 * that enters an out-of-band density range must be added here with its own
 * rationale, and a stale record is also a gate failure.
 */
const RULING_SEEDS = [
  ["en", 1, "below-3%", "Hexagram 1 is carried by the authored creative-force interpretation, Judgment and Image provenance, six line records, and the unchanging reading. Its lower family density reflects preserving that explanatory arc rather than repeating the entity phrase after every practical point."],
  ["en", 2, "below-3%", "Hexagram 2 explains receptive capacity through the classical text, line sequence, and a distinct account of support without passivity. Adding more exact keyword mentions would flatten the difference between receiving conditions and merely repeating the page name."],
  ["en", 3, "below-3%", "Hexagram 3 uses its authored material to follow an unsettled beginning: finding help, ordering steps, and allowing revision. The page answers the beginning-difficulty intent through those actions, so forced family repetition would not add a new user-facing idea."],
  ["en", 4, "below-3%", "Hexagram 4 is organized around learning, asking a useful question, and building judgment rather than receiving a one-time answer. The lower density preserves the instructional progression and avoids turning every learning step into an artificial entity mention."],
  ["en", 5, "below-3%", "Hexagram 5 treats waiting as active preparation: checking resources, risk, and readiness before conditions mature. Its useful content is temporal and procedural, and repeating the exact primary phrase would not clarify that waiting process."],
  ["en", 7, "below-3%", "Hexagram 7 develops organization through shared purpose, responsibility, and discipline, with the line sequence showing how leadership can serve a task. More exact family mentions would obscure the distinction between collective order and personal force."],
  ["en", 8, "below-3%", "Hexagram 8 addresses belonging through long-term behavior, mutual support, and the choice to maintain a trustworthy connection. The relationship intent is already expressed in concrete criteria; repeating the page entity would add density without adding discernment."],
  ["en", 9, "below-3%", "Hexagram 9 makes small accumulation and gentle restraint the explanatory thread, including the difference between preparation and premature completion. The page needs room for that gradual sequence rather than repeated exact keyword anchors."],
  ["en", 10, "below-3%", "Hexagram 10 is written as careful movement through boundaries, consequence, and social proportion. Its six lines supply the practical distinctions; inserting the primary phrase into each distinction would make the walking metaphor less natural."],
  ["en", 11, "below-3%", "Hexagram 11 explains open circulation together with the maintenance needed to keep a favorable condition usable. The authored discussion already balances exchange and future change, so density should not be raised by repeating the entity in transition sentences."],
  ["en", 12, "below-3%", "Hexagram 12 is intentionally about blocked communication, self-protection, and conserving judgment until contact is possible. Repeating the exact phrase in every caution would work against the page's restrained treatment of obstruction."],
  ["en", 14, "below-3%", "Hexagram 14 connects possession with transparent distribution, restraint, and responsibility. The page's value is the ethical handling of influence rather than celebrating possession as a label, so exact family repetition remains deliberately limited."],
  ["en", 18, "below-3%", "Hexagram 18 follows repair back to its source: inherited habits, responsibility, and the small structural changes that prevent recurrence. The lower density protects the diagnostic narrative instead of labeling each repair step with the same phrase."],
  ["en", 20, "below-3%", "Hexagram 20 asks the reader to step back, observe the whole, and examine what conduct is demonstrating. Because the page's central action is observation rather than declaration, more entity mentions would be especially intrusive in the reflective sections."],
  ["en", 21, "below-3%", "Hexagram 21 treats an obstacle through facts, rules, proportionate decision, and room for repair after judgment. The content already covers the decision intent in distinct stages; repeating the primary keyword would not improve procedural clarity."],
  ["en", 22, "below-3%", "Hexagram 22 deliberately separates helpful form from substance that must remain real. The low density preserves that contrast and avoids using the entity phrase as decorative surface inside every paragraph."],
  ["en", 23, "below-3%", "Hexagram 23 keeps Splitting Apart and Bo in an interpretive, non-fatalistic frame: protect what is sound, reduce what cannot hold, and do not dramatize loss. Repetition would weaken that distinction and risk turning the page into a label-driven warning."],
  ["en", 25, "below-3%", "Hexagram 25 explains innocence as honest contact with facts while retaining judgment and responsibility. The page-specific guidance already rejects wishful control; additional exact mentions would make that warning feel formulaic."],
  ["en", 26, "below-3%", "Hexagram 26 is built around storing strength, learning from precedent, and choosing when restraint becomes readiness. The six lines and unchanging section carry those temporal distinctions without needing repeated entity anchors."],
  ["en", 28, "below-3%", "Hexagram 28 addresses unusual structural load by locating support, naming overload, and permitting a necessary adjustment. The practical meaning lies in the support diagnosis, not in increasing the phrase count for the entity."],
  ["en", 29, "below-3%", "Hexagram 29 handles repeated risk through one observable step, a trustworthy companion, and a route out. Repeating the danger-related entity phrase would add alarm but not the grounded safety distinction the page is meant to provide."],
  ["en", 30, "below-3%", "Hexagram 30 uses clarity together with the question of what can safely support it. The authored material distinguishes illumination from dependence, and preserving that distinction is more useful than adding exact family matches."],
  ["en", 32, "below-3%", "Hexagram 32 treats endurance as a living practice that adjusts without abandoning its core. Its content is about continuity and review over time; repeated primary phrases would make that long-horizon reading less readable."],
  ["en", 34, "below-3%", "Hexagram 34 pairs strong momentum with strict self-restraint and reality checks. The page already makes power accountable through its line progression, so a higher numeric density would risk sounding like a promise of force."],
  ["en", 36, "below-3%", "Hexagram 36 protects discernment when circumstances make visibility unsafe or unhelpful. The authored content emphasizes preserving inner clarity and choosing exposure carefully; keyword repetition would undermine that quiet protective register."],
  ["en", 37, "below-3%", "Hexagram 37 works through roles, ordinary responsibilities, and agreements inside a close group. The page needs concrete relationship behavior more than repeated family phrases, especially in its six line applications."],
  ["en", 40, "below-3%", "Hexagram 40 separates releasing a tension from abandoning an unfinished responsibility. The practical reading is carried by that sequence of solving, releasing, and regaining flexibility; exact phrase repetition would not deepen it."],
  ["en", 41, "below-3%", "Hexagram 41 asks what can be reduced without damaging the base that makes future action possible. Its authored value is the boundary around sacrifice, so adding the entity phrase to every trade-off would be counterproductive."],
  ["en", 44, "below-3%", "Hexagram 44 treats sudden contact as information that still requires boundaries and distance. The page-specific reading is intentionally cautious about attraction and influence, so repeating the primary phrase would make the caution less natural."],
  ["en", 45, "below-3%", "Hexagram 45 examines what happens after people, resources, and attention gather: rules and care must carry the concentration. The page already covers gathering and stewardship through authored sections rather than repeated labels."],
  ["en", 46, "below-3%", "Hexagram 46 presents progress as gradual ascent from a sound base, with guidance and correction along the way. The lower density preserves the stepwise movement and avoids making growth sound like a guaranteed result."],
  ["en", 47, "below-3%", "Hexagram 47 is concerned with constrained resources, dignity, and finding trustworthy support when expression is limited. Repeating the entity phrase in the recovery guidance would add pressure to an already restrained page."],
  ["en", 48, "below-3%", "Hexagram 48 explains a shared well through maintenance, access, and dependable use rather than ownership. The page's concrete resource language already answers the entity intent; extra exact matches would make the commons metaphor mechanical."],
  ["en", 49, "below-3%", "Hexagram 49 keeps change accountable to evidence, timing, and a reason others can understand. Because the authored page distinguishes preparation, transition, and aftermath, inserting the keyword into every stage would reduce the sense of actual change."],
  ["en", 50, "below-3%", "Hexagram 50 treats transformation as changing a vessel that can continue to serve a community. The page-specific content is about what the new container makes possible, so repeating the entity name would not improve that structural explanation."],
  ["en", 51, "below-3%", "Hexagram 51 distinguishes a sudden shock from the meaning assigned to it afterward. The authored guidance asks for stabilization and evidence instead of omens; higher keyword density would work against that grounded treatment."],
  ["en", 52, "below-3%", "Hexagram 52 is about locating an appropriate stopping point, including the substantive same-page treatment of line 3. The page's value comes from position and restraint, not from repeating the entity phrase around the line-specific explanation."],
  ["en", 54, "below-3%", "Hexagram 54 includes the approved relationships and romance discussion of position, reciprocity, consent, and dignity. That module is deliberately non-predictive; extra exact mentions could make a sensitive relationship reading feel like a keyword block."],
  ["en", 56, "below-3%", "Hexagram 56 treats travel and temporary belonging through courtesy, self-possession, and attention to local conditions. The page-specific advice already gives the traveler useful choices, so repeating the primary phrase would not add orientation."],
  ["en", 57, "below-3%", "Hexagram 57 presents influence as gradual entry through clear, repeated, respectful communication. Its practical value is in how influence is received and bounded; exact phrase repetition would confuse persistence with pressure."],
  ["en", 58, "below-3%", "Hexagram 58 grounds openness and joy in honest exchange rather than pleasing performance. The authored sections already separate encouragement from light promises, and the lower density protects that distinction."],
  ["en", 59, "below-3%", "Hexagram 59 follows the movement from blockage and emotional separation toward renewed connection. The page's useful sequence is release, re-centering, and cooperation; repeating the entity term at each step would make the transition artificial."],
  ["en", 60, "below-3%", "Hexagram 60 distinguishes boundaries that create freedom from rules that become punitive. That calibrated treatment is already carried by the line and unchanging sections, so added exact matches would make the limit itself too rigid."],
  ["en", 61, "below-3%", "Hexagram 61 grounds inner truth in conduct and includes the substantive same-page line 5 explanation. Trust is tested through interaction rather than declarations, so repeating the entity phrase would weaken the page's evidence-based tone."],
  ["en", 62, "below-3%", "Hexagram 62 directs attention to small, controllable steps during pressure or transition. The page intentionally avoids grand promises; keeping density below the soft band supports that small-scale reading instead of exaggerating the entity."],
  ["en", 63, "below-3%", "Hexagram 63 treats completion as a point that still requires maintenance, review, and prevention. Its authored value is in the aftercare sequence, and exact keyword repetition would not make that warning more complete."],
  ["en", 64, "below-3%", "Hexagram 64 remains a singular before-completion entity page: it describes an unfinished transition and the next careful step, never the 64-hexagram hub. The restrained density preserves that singular intent and avoids broadening the page's subject."],
  ["zh-Hans", 8, "above-5%", "第8卦的中文页面包含工作簿允许的关系场景模块，额外讨论信任、选择与互相承担；这些词族来自真实解释而非列表堆砌。保留场景内容比为了降低比例删掉关系判断更符合页面意图。"],
  ["zh-Hans", 13, "above-5%", "第13卦的超限来自允许的关系场景说明：它把差异中的共同目标、公开协作和个人自主性落到现实关系。该模块承担独立阅读价值，不能为了软密度区间删成只剩卦名和经典文本。"],
  ["zh-Hans", 25, "above-5%", "第25卦在工作簿关系场景 allowlist 内，页面额外解释亲近、边界与不把愿望当成事实的风险。受保护词族增加是场景信息的结果，保留这层边界比人为稀释主题更自然。"],
  ["zh-Hans", 36, "above-5%", "第36卦没有场景模块；超限来自固定卦辞、大象、六条经典爻辞、中文实体术语和页面的守明解释共同出现。应保留受挫环境中的保护判断内容，不用删减经典语境换取数字比例。"],
  ["zh-Hans", 39, "above-5%", "第39卦的超限来自工作簿允许的关系场景模块，重点是困难中的求助、边界和互相尊重。它不是重复关键词，而是把阻碍如何影响关系选择讲清楚，因此接受该页面特定例外。"],
  ["zh-Hans", 54, "above-5%", "第54卦不在中文场景模块 allowlist 中；超限来自固定经典实体文本、六条中文爻位说明和关系位置主题的自然交叠。它应继续保持位置、互惠与自主性的本卦解释，不应误报为场景模块。"],
] as const;

export const DENSITY_REVIEW_RULINGS: readonly DensityReviewRuling[] = RULING_SEEDS.map(
  ([locale, number, expectedBand, rationale]) => ({
    locale,
    number,
    expectedBand,
    rationale,
    reviewedBy: "content-review-v1",
  }),
);

const RULING_BY_KEY = new Map(
  DENSITY_REVIEW_RULINGS.map((ruling) => [ruling.locale + ":" + ruling.number, ruling] as const),
);

export function densityReviewRulingFor(locale: ContentLocale, number: number): DensityReviewRuling | null {
  return RULING_BY_KEY.get(locale + ":" + number) ?? null;
}
