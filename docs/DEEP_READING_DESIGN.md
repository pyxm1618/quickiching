# Commercial V2 深度解读设计

**状态：** 设计已定稿，实施中
**日期：** 2026-08-29

## 为什么要重做

付费深度解读原来的生成方式是：把卦号和用户问题丢给模型，要求它输出十个模块。`src/server/generation/ai-sdk-provider.ts` 里的 prompt 只有四行，第一行自称 "a future Deep Reading generator"，不含任何易学内容。这条路有三个必然后果：

1. **引用会错。** 模型凭参数记忆背卦辞爻辞，张冠李戴无法避免。
2. **结论会飘。** 同一卦同一问题，两次生成可能给出相反方向。
3. **答非所问。** 复述一遍问题，然后泛泛谈卦象，套在谁身上都成立。

## 核心原则

**AI 不产生判断，只产生表达。**

三件事由代码按古法规则确定，AI 无权改动：

- 断吉凶方向
- 选主断爻辞
- 定问题与卦的对应关系

AI 拿到的是**已定的结论 + 已选的原文**，它唯一的任务是把结论落到用户那件具体的事上。

## 四层架构

### Layer 1 · 确定性断例引擎（纯 TS，零 AI）

位置：`src/domain/interpretation/deterministic/`

**① 变占规则** — 朱熹《易学启蒙·考变占》七条，决定主断原文：

| 动爻数 | 主断依据 |
| --- | --- |
| 0 | 本卦卦辞 |
| 1 | 本卦该动爻爻辞 |
| 2 | 本卦二动爻辞，以上爻为主 |
| 3 | 本卦 + 之卦卦辞，以本卦为主 |
| 4 | 之卦二不变爻辞，以下爻为主 |
| 5 | 之卦唯一不变爻辞 |
| 6 | 乾坤取用九/用六，余卦取之卦卦辞 |

**② 体用生克** — 把问题绑到卦上的古法机制。动爻所在经卦为「用」（所问之事），另一卦为「体」（求测者）。八卦配五行：乾兑金、震巽木、坤艮土、坎水、离火。

| 关系 | 方向 |
| --- | --- |
| 用生体 | 吉，事来助我 |
| 比和 | 顺，同频 |
| 体克用 | 小吉，我能掌控 |
| 体生用 | 耗，我持续付出 |
| 用克体 | 阻，事压我 |

**边界：** 体用成立的前提是动爻集中在单一经卦内。三枚硬币法可能上下卦皆有动爻，此时 `tiYong` 必须显式为 `null`，退回变占规则 + 爻位 + 内外卦，**不得硬凑**。

**③ 爻位结构** — 当位/失位（阳居 1/3/5、阴居 2/4/6 为当位）、得中（2/5）、中正、相应（1-4、2-5、3-6 一阴一阳为有应）、六爻位象（初为事始、三多凶、四多惧、五为君位、上为亢）。

**④ 内外卦与卦变** — 内卦为己/近期，外卦为人/远期；互卦（2345 爻）为过程；综卦为对方立场。

产出 `DeterministicVerdict`，**直接展示给用户，不经 AI**。

### Layer 2 · 问题绑定（映射表，不用 AI）

用户起卦前已填 `scene`（7 类）+ `interpretationGoal`（5 类）+ 问题正文，问题已经结构化，不需要 AI 再解析。

只需一张映射表：`scene` 决定体用指向（career：体=我的能力，用=职位/机会；relationships：体=我，用=对方），`goal` 决定哪些模块加重。

### Layer 3 · AI 只做应用

输入是 Layer 1+2 的完整结论 + 逐字原文。Prompt 硬约束：

- `verdict.direction` 是既定结论，不得改变、反转或模糊化
- `oracleText` 是唯一可引用的原文，逐字引用，不得改写或补充其他卦爻辞
- 必须落到用户问题中的具体人、事、时间
- 不得使用可套用于任何人的表述

**断语强度（已定）：** 给方向，但一律条件化表达（「若……则……」）。既有信息量，又不构成绝对预言，与现有非决定论边界声明一致。

### Layer 4 · 确定性校验（不是 AI 审 AI）

现有 `generation_output_reviews` 是模型审模型，需补代码校验：

- 引用原文 **字符串精确匹配** Layer 1 提供的文本
- AI 输出带 `verdictEcho` 字段，必须等于 Layer 1 的 direction，不等即打回
- 禁语扫描（绝对预言、医疗/法律/投资指令）
- 具体性检查：用户问题的关键名词须出现在输出中

## 经文与英文（已定）

**中文原文已就绪**：`src/domain/public-reading/classical-source-data.ts` 含 64 卦卦辞、象辞、384 爻辞、用九用六，有固定 Wikisource oldid、SHA256 快照与 `bun run verify:classical-sources` 校验。

**英文不引用任何第三方英译。** 原计划采用 Legge 1882 公版英译，2026-08-30 调查后放弃（见 `LEGGE_ENGLISH_SOURCE_EVALUATION.md`）：公开可得的固定来源里不存在一份可逐字节复验的完整 Legge——Wikisource 只录到第 31 卦且无 Appendix II，archive.org 只有 OCR（15–18% 段落含静默错字），ctext / sacred-texts 是改写版（line → NINE）且拦机器人。

英文解读改为三层，无溯源风险：

1. **古文原文**：中文，逐字引用，带 Wikisource 固定版本 + SHA256 —— 已有，64 卦齐全
2. **英文释义**：由解读本身给出，明确标为 QuickIChing 原创，不冒充历史译本
3. **结构分析**：体用、爻位、变占规则 —— 语言无关，由 `deterministic/localize.ts` 按 locale 渲染

这已写进 prompt（`QUOTE_SCRIPT_NOTE.en`）：英文输出必须逐字引用中文原文，并在每条引用后紧跟自己的英文释义，不得留下未翻译的汉字片段。

**象辞（image）不在需求内。** `OracleTextRef` 只有 `judgment` / `line` / `use_line` 三种，变占七条永远不会选中象辞，付费解读一次都不会引用它。

**`pending_license` 作废**：`src/domain/generation/schemas.ts` 中 `status: z.literal("pending_license")` 是过时假设，v2 改为带 `sourceWork` / `sourceUrl` 的真实引用。

## 多语言

`ContentLocale`（`src/i18n/config.ts`）贯穿全链路：

- **引擎只出标识符**（`ruleId`、`trigram`、`relation`、position），不含任何展示文字
- **`deterministic/localize.ts`** 承载全部呈现文字，按 locale 分表。加一门语言 = 加一列，断卦规则一行不动
- **prompt 用英文写指令 + 输出语言指令**，避免每加一门语言维护一份翻译版
- **校验器按语言分表**：条件句标记按 locale 取；绝对预言与越界指令**所有语言的模式一律全跑**，中英混写不能逃过检查
- **locale 在请求时解析**（`/api/readings/[id]/deep` 读 `x-quickiching-locale` 头或 referer 的 `/zh` 段），显式传递到 workflow。`casting_sessions` 没有 locale 列，绝不在深处静默默认

## 实施顺序

1. ~~**Layer 1 引擎**（纯函数 + 测试）~~ ✅ 完成
2. ~~Legge 英译语料录入~~ ❌ 取消，改为"中文原文 + 原创英文释义"
3. ~~schema v2 + `pending_license` 移除~~ ✅ 完成（v1 保留给离线适配器与 legacy UI）
4. ~~Layer 2 映射表~~ ✅ 完成（`src/domain/interpretation/question-framing.ts`）
5. ~~Layer 3 prompt 重写~~ ✅ 完成（`src/server/generation/deep-reading-prompt.ts`）
6. ~~Layer 4 确定性校验~~ ✅ 完成（`src/server/generation/reading-validator.ts`）
7. ~~多语言参数贯通~~ ✅ 完成
8. 真实模型跑一次并人工评估 ← **未完成**（已用 Claude 扮演模型验证过设计，见 `DEEP_READING_SAMPLE.md`；真实 API 未跑）
9. 前端展示（P0-1）← **未完成**
