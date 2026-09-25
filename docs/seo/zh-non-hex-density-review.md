# 简体中文 9 个非 64 卦页面内部关键词防堆砌门禁（Internal Anti-stuffing Guardrail）审查表

## 1. 门禁性质与重新定义说明

在 PR #45 收口过程中，对 9 个中文非 64 卦页面的关键词密度机制进行了重新定性与审计规范：

1. **准确定义为“内部关键词防堆砌门禁 (Internal anti-stuffing guardrail)”**：
   - 本指标**不是**外部量化 SEO 证据（如 Google 官方推荐值或 Semrush 量化指标）；
   - 本指标的唯一目的在于：
     - 作为工程与内容质量的内部防线，防止未来编辑或代码更新时在正文中出现机械式重复；
     - 防止某次修改突然把关键词家族密度推高到失真水平；
     - 确保页面在自然流畅的中文表达下，关键词出现频率处于结构合理的上下限之内。
2. **外部量化证据保持诚实标注**：
   - 因 Semrush API 额度不足，未取得权威的 Search Volume、Keyword Difficulty (KD) 与 Competition 指标；
   - 外部定量证据统一明确标记为 `externalQuantitativeEvidence = UNVERIFIED`，坚决不编造或猜测任何未经证实的数据。

---

## 2. 4 大内容分类 Profile 契约矩阵

所有 9 个页面根据其交互形式、字数规模及语义必要性，显式绑定至对应的 `densityProfile`，契约定义于 `src/content/seo/zh-pages.ts` 的 `ZH_DENSITY_PROFILES`：

| Profile 类型 | 适用页面路径特征 | 页面架构与语义特征 | Primary 门禁区间 | Family 门禁区间 | 门禁约束目的 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **hub** (聚合导航) | `/zh/hexagrams` | 挂载 64 卦卡片与文王卦序索引，总字数大（>3000 字），核心词仅在导言与架构性指引出现 | 0.10% – 0.80% | 0.20% – 2.00% | 防范在卦象列表头部或尾部人为机械刷词 |
| **portal** (主站门户) | `/zh` | 整合 4 种起卦入口、易经核心流程导引、六十四卦预览，结构层次丰富（~1000 字） | 0.80% – 2.00% | 2.00% – 5.00% | 确保门户主词自然呼应，不过度堆砌 |
| **tool** (交互起卦) | `/zh/methods/*` | 交互式起卦仪式（铜钱、蓍草、梅花、手动），含操作指引、参数说明与推演逻辑（200~600 字） | 0.40% – 2.50% | 1.50% – 10.00% | 兼顾紧凑操作说明中专业术语不可替代的高频出现 |
| **guide** (深度指南) | `/zh/guides/*` | 深度义理与实操长文，章节详细，包含大量反思与案例比对（400~500 字） | 0.50% – 2.00% | 1.00% – 11.00% | 适应核心对偶范畴（如“本卦”与“变卦”）在正文解析中的自然高频出现 |

---

## 3. 9 个页面真实实测与门禁契约对照表

下表数据由 `scripts/chinese-seo-browser-gate.mjs` 在真实 Chromium 浏览器环境下，通过相同的 Tokenization（分词器与停用 Latin 符号过滤）实测计算产出，严禁手填与估算：

| route | profile | primaryKeyword | eligibleTokenCount | primaryOccurrences | primaryDensity (实测) | familyOccurrences | familyDensity (实测) | configuredPrimary (Min ~ Max) | configuredFamily (Min ~ Max) | researchStatus | externalQuantitativeEvidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/zh` | `portal` | 易经在线起卦 | 981 | 9 | **0.92%** | 21 | **2.14%** | 0.8% ~ 2.0% | 2.0% ~ 5.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/methods/three-coin` | `tool` | 三枚铜钱起卦 | 358 | 4 | **1.12%** | 14 | **3.91%** | 1.0% ~ 2.0% | 3.0% ~ 5.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/methods/yarrow-stalks` | `tool` | 蓍草起卦 | 340 | 5 | **1.47%** | 6 | **1.76%** | 1.0% ~ 2.5% | 1.5% ~ 5.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/methods/mei-hua-yi-shu` | `tool` | 梅花易数起卦 | 604 | 5 | **0.83%** | 22 | **3.64%** | 0.4% ~ 2.0% | 2.5% ~ 5.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/methods/manual-cast` | `tool` | 手动起卦 | 228 | 3 | **1.32%** | 16 | **7.02%** | 1.0% ~ 2.5% | 3.0% ~ 10.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/guides/how-to-ask-the-i-ching` | `guide` | 易经怎么问 | 482 | 3 | **0.62%** | 6 | **1.24%** | 0.5% ~ 2.0% | 1.0% ~ 5.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/guides/changing-lines` | `guide` | 易经动爻 | 459 | 4 | **0.87%** | 24 | **5.23%** | 0.8% ~ 2.0% | 3.0% ~ 7.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/guides/primary-relating-hexagrams` | `guide` | 本卦变卦 | 426 | 4 | **0.94%** | 37 | **8.69%** | 0.8% ~ 2.0% | 3.0% ~ 11.0% | `UNVERIFIED` | `UNVERIFIED` |
| `/zh/hexagrams` | `hub` | 易经六十四卦 | 3085 | 4 | **0.13%** | 8 | **0.26%** | 0.1% ~ 0.8% | 0.2% ~ 2.0% | `UNVERIFIED` | `UNVERIFIED` |

### 关键词家族成员说明（Approved Family Lists）
- `/zh`: `["易经在线起卦", "周易在线起卦", "易经起卦", "在线起卦", "三枚铜钱起卦", "蓍草起卦", "梅花易数起卦", "手动起卦"]`
- `/zh/methods/three-coin`: `["三枚铜钱起卦", "铜钱起卦", "三枚铜钱法", "易经铜钱起卦", "三枚硬币起卦", "铜钱法", "六次掷币", "动爻"]`
- `/zh/methods/yarrow-stalks`: `["蓍草起卦", "蓍草法", "蓍草筮法", "大衍筮法", "四十九根蓍草", "三变成爻", "十八变成卦", "蓍草占筮"]`
- `/zh/methods/mei-hua-yi-shu`: `["梅花易数起卦", "梅花易数", "梅花易数时间起卦", "梅花易数怎么起卦", "时间起卦", "数字起卦", "上卦", "下卦", "动爻"]`
- `/zh/methods/manual-cast`: `["手动起卦", "易经手动起卦", "六爻手动起卦", "手动输入卦象", "六爻值", "本卦", "动爻", "变卦", "指定动爻"]`
- `/zh/guides/how-to-ask-the-i-ching`: `["易经怎么问", "易经问卦", "问卦怎么问", "易经提问", "一事一问", "问题怎么问", "重复问卦", "是否问题"]`
- `/zh/guides/changing-lines`: `["易经动爻", "动爻", "变爻", "易经变爻", "老阴", "老阳", "变卦", "爻位", "多个动爻"]`
- `/zh/guides/primary-relating-hexagrams`: `["本卦变卦", "本卦", "变卦", "之卦", "本卦和变卦", "动爻", "卦象变化", "主卦"]`
- `/zh/hexagrams`: `["易经六十四卦", "周易六十四卦", "六十四卦", "易经64卦", "六十四卦卦序", "卦辞", "爻辞", "卦象"]`

---

## 4. 自动化测试与 CI 门禁闭环

1. **注册表单元测试校验**（`src/content/seo/zh-pages.test.ts`）：
   - 验证每个条目必须绑定合法的 `densityProfile`；
   - 验证每个页面的配置区间严格落在其绑定的 Profile 合同之内；
   - 确保 `familyDensityMax` 严格不超过 11.0%（坚决废除过去的 15% 宽松门槛）；
   - 验证 `researchStatus === "UNVERIFIED"` 时禁止虚构量化指标。
2. **浏览器真实渲染全量审计**（`scripts/chinese-seo-browser-gate.mjs`）：
   - 在真实浏览器 DOM 中提取 `eligibleText`，执行 Tokenization 与关键词家族匹配；
   - 9 个页面实测结果全部必须处于 `[configuredFamilyMin, configuredFamilyMax]` 与 `[configuredPrimaryMin, configuredPrimaryMax]` 区间之内；
   - 执行机械重复检测（`mechanicalPrimaryRepetition`），杜绝任何连续堆词行为。
