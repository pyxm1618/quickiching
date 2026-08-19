# Quick I Ching 产品需求文档

**版本：** V3.0 Stage Split  
**日期：** 2026-08-10  
**首发语言：** English  
**产品形态：** 多玩法 I Ching 在线起卦、文化解释与自我反思平台  
**当前发布阶段：** Public SEO V1  

> 本文档取代旧 V2.1 中“完整商业 MVP 完成后才能公开”的阶段假设。未来商业需求没有取消，而是明确后移到 Commercial V2。

---

## 1. 产品阶段定义

### 1.1 Public SEO V1 — 当前 Google + Bing 首次收录版本

目标：让用户从搜索进入后，在没有账号、支付、数据库或生产 AI 凭据的情况下，真正完成一次有阅读价值的 I Ching reading。

核心 SEO intent：`i ching online`。

首页 `/` 是全站核心 SEO Landing Page，默认直接提供 Three-Coin Method；Quick I Ching 的长期定位仍是多种起卦方式的在线 I Ching 平台，不是单纯的 coin-only 网站。

首发必须真实可用：

1. Three-Coin Method
2. Yarrow Stalk Method
3. Mei Hua Yi Shu — Current-Time Casting
4. Manual Cast — deterministic line input

四种方法的免费闭环统一为：

可选 Question-first → 完成六爻 → Primary Hexagram → Changing Lines → Relating Hexagram（存在动爻时）→ Free Basic Interpretation → 可选本地 History 保存。

免费层至少展示：

- Primary Hexagram number/name
- 六爻图形
- Changing Line positions
- Relating Hexagram number/name（如存在）
- 本卦简洁基础解释
- 变化位置的基础说明
- 之卦简洁基础解释（如存在）
- reflection / interpretive framework / not deterministic prediction / not professional advice 边界

免费层解释**卦象本身**，不依赖 AI。用户明确点击后，才允许进入独立的 personalized interpretation seam；它必须经过风险检查、Turnstile 和 AI Gateway 配置，生产未激活或失败时 fail-closed 并保留完整静态结果。

### 1.2 Commercial V2 — 保留的未来商业产品

Commercial V2 继续保留下列原商业需求，但不再阻断 Public SEO V1 的搜索引擎上线：

- 用户输入：场景、解释目标、具体情境；一次只处理一个主要问题。
- 高风险边界：医疗、法律、投资、紧急安全等不得由占卜替代专业决策。
- 同一问题重复占问控制；原方案以 72 小时为产品方向。
- anonymous → production auth → account binding。
- production database 与持久化 reading history。
- personalized AI Deep Reading：结合用户具体情境、目标和描述进行深度解释。
- Production AI Gateway / model provider 与生成质量验证。
- Payment / credits；原商业方案保留 1 / 3 / 5 次包方向。
- 后台生成任务、失败释放 entitlement、成功后固定保存。
- 质量复核与 replacement credit 机制。
- 隐私删除、账户删除、支付账本、退款/争议等商业运营能力。
- 商业安全、rate limit、anti-abuse、支持、监控和事故处置。

Commercial V2 上线前必须重新完成法律、支付、隐私、AI、账户安全和数据持久化专项验收。

---

## 2. Public SEO V1 信息架构

### 2.1 Canonical URLs

- `/` — primary intent: `i ching online`
- `/methods/three-coin` — `i ching coin` / `three coin i ching` / `i ching coin toss` cluster
- `/methods/yarrow-stalks` — yarrow stalk cluster
- `/methods/mei-hua-yi-shu` — mei hua / plum blossom cluster
- `/methods/manual-cast` — deterministic manual input cluster
- `/guides/how-to-ask-the-i-ching`
- `/guides/changing-lines`
- `/guides/primary-relating-hexagrams`
- `/hexagrams` — 64 Hexagrams Hub
- `/hexagrams/[fixed-slug]` — 64 fixed entity pages with six line anchors
- `/history` — browser-only saved readings; private, noindex, excluded from sitemap

原则：**One primary intent = one canonical URL**，不是 one keyword = one URL。

旧近义 URL 必须通过相关 301/308 迁移到上述 canonical，不制造重复内容，也不统一跳首页。

### 2.2 首页固定 TDH

Title:

`I Ching Online — Free Hexagram Reading | Quick I Ching`

Meta Description:

`Use the I Ching online with Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, or Manual Cast. See changing lines and get a free grounded interpretation.`

H1:

`I Ching Online — Cast Your Hexagram`

### 2.3 首页内容顺序

1. Header
2. H1 + 极简介绍
3. Optional Question-first + 完整 Three-Coin Tool
4. 免费结果区域
5. Other I Ching Casting Methods
6. How I Ching Online Readings Work
7. Understanding Your Reading
8. Common Questions About I Ching Online
9. Footer

首页不以 Pricing、Preview、Coming Soon 或商业状态说明为主要内容。

### 2.4 方法页

每个方法页必须同时是工具页与独立 SEO 页面，并具备独立 Title / Description / H1 / intro / 原理 / 真正工具 / 结果说明 / Related Guides / 描述性内链。

---

## 3. Public V1 领域规则

### 3.1 Three Coin

- yang/head = 3；yin/tail = 2
- 每次三枚，得到 6/7/8/9
- 六次起卦，bottom-to-top
- 6 / 9 为 moving lines
- 所有方法共享同一 King Wen mapping / primary / relating 计算
- 正式浏览器随机源使用 Web Crypto，不使用 `Math.random()`
- 已产生单爻不可单独编辑；New reading 清空整次浏览器会话

### 3.2 Yarrow Stalk

Public V1 使用 `yarrow-zhu-xi-digital-v2`：

- 49 working stalks
- 三变成一爻，18 changes 成一卦
- 每一步保留分堆、挂一、两边以四计余数和 ending stalks 的 conservation 证据
- 数字化概率约定显式固定：第一次移除 5/9 为 3:1；后两次移除 4/8 为 1:1
- 最终 6/7/8/9 概率为 1/16, 5/16, 7/16, 3/16
- 浏览器 sessionStorage 支持 interruption/resume

该数字约定不声称所有实体蓍草分堆习惯具有完全相同的经验随机分布。

### 3.3 Mei Hua Yi Shu

Public V1 使用 `quickiching-gregorian-current-time-v2`，不是笼统的“唯一标准梅花易数”：

- current-time only
- user-confirmed IANA timezone
- Gregorian civil calendar
- Gregorian year → terrestrial-branch ordinal，2020 = Zi = 1
- Gregorian month/day
- Zi hour = 23:00–00:59
- 23:00 按下一 Gregorian formula date 计算
- lunar calendar 不使用
- lunar leap month 不适用
- Gregorian leap day 正常处理
- DST 按 IANA timezone / Intl 处理

传统年月日時起例的数字结构保留：年月日取上卦；加时取下卦；总数除六取动爻。

详细 provenance：`docs/PUBLIC_SEO_V1_PROVENANCE.md`。

---

## 4. Free Basic Interpretation

Public V1 不公开复制未经许可的现代英文 I Ching 译文。

基础解读使用 Quick I Ching 原创简洁文本，只解释一般 hexagram theme 与结构变化，不读取用户私人上下文。

未来 Commercial V2 的付费价值边界：在用户明确提交的具体情境与目标上做个性化深度解释。

---

## 5. Trust / Safety

所有公开 reading 维持：

- reflection, not deterministic prediction
- not medical/legal/financial/safety advice
- 不制造焦虑依赖
- 不鼓励为了追求喜欢的答案不断重复占问

Public V1 Legal / Help 页面必须描述当前真实状态：browser-only History 可以显式保存，但 production auth/payment/cloud history 未开放；personalized AI 只有在全部 provider/safety activation 条件满足时才可使用。

---

## 6. SEO / HTTP Launch Gate

Canonical production host：`https://www.quickiching.com`。

要求：

- indexable canonical page = 200
- permanent move = 301/308
- missing route = 404；明确撤下的商业 route 可用 410
- 不存在页面不能统一 307 到首页
- self-canonical
- sitemap 仅包含 canonical + indexable + 200 + 有真实价值的页面
- robots 提供 `https://www.quickiching.com/sitemap.xml`
- IndexNow 使用稳定 key 与 dry-run-first CLI；最终独立审核前禁止 production submit
- initial HTML 必须包含页面 TDH、H1、正文介绍和普通 `<a>` / Next `<Link>` 内链

---

## 7. 本阶段明确不扩展

Public SEO V1 不为了“完整”而默认启用：

- 未配置并未通过安全门禁的 production AI deep reading
- payment / credits / checkout
- production auth / account / cloud history（browser-only local History 属于 Public P0）
- Liu Yao / Wen Wang Gua / 数字起卦 / 每日一卦
- AI chat oracle
- community / subscription / CMS / multilingual / hreflang
- 384 个爻级运行时详情页或 4096 个卦变详情页

---

## 8. Public SEO V1 完成定义

只有四种方法都完成真实免费闭环、73 个 indexable URL 技术 SEO 干净、desktop/mobile 核心路径通过、构建和自动化测试通过，才能标记 `READY FOR FINAL SEO AUDIT`。Question-first、Manual A/B、local History、隐私边界和 personalized fail-closed 也必须有对应门禁证据。

独立最终审核通过前：

- 不提交 Google Search Console
- 不向 Bing 发送 production IndexNow
- 不自动 merge main
