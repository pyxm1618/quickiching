# Legge 1882 英译来源评估（结论：不可用）

调查日期：2026-08-30

## 一句话结论

公开可得的固定来源里，**不存在一份可逐字节复验的完整 Legge 1882 英译**。四条路全部走到能判定的程度，全部淘汰。

**这不影响产品**：付费深度解读的 `OracleTextRef` 只有 `judgment` / `line` / `use_line` 三种，变占七条规则永远不会选中象辞；且英文站引用中文原文即可（`src/domain/public-reading/classical-source-data.ts`，64 卦齐全、Wikisource 固定 oldid + SHA256 可复验），英文释义由解读本身产出并明确标为 QuickIChing 原创，不冒充历史译本。

**写这份文档的目的**：避免有人半年后重走一遍这四条路。

---

## 背景：判定标准

评估的不是"有没有英文翻译"——Legge 1882（Sacred Books of the East Vol. XVI）**完整翻译了 64 卦及十翼**，1882 年出版、译者 1897 年逝世，公版无疑。

评估的是能否满足本仓库既有的溯源强度（见 `scripts/verify-classical-sources.ts`）：**写进数据文件的每个字符，都必须能被一个独立运行的脚本重新抓取并逐字节比对通过。**

来源须同时满足四条：完整（64 卦）、脚本可访问、版本可钉死、内容逐字忠于 1882 原文。

---

## 四来源汇总

| 来源 | 覆盖 | 判定 | 淘汰原因 |
|---|---|---|---|
| en.wikisource | 1–31 卦，无象辞 | 文本可信但残缺 | 志愿者校对止于第 31 卦 |
| archive.org OCR（2 个 item） | 全书 | 保真度不足 | 81.7% / 84.5% 精确命中，错误为静默错字，32–64 卦无基准可测 |
| ctext.org | 全 64 卦 + 象辞 | 双重淘汰 | CAPTCHA 拦截自动访问；文本为改写版 Legge |
| sacred-texts.com | 全 64 卦，无象辞 | 双重淘汰 | Cloudflare 403；与 ctext 同源改写版，1.1% 精确命中 |

---

## 1. en.wikisource —— 文本可信，但只到第 31 卦

页面树：`Sacred Books of the East/Volume 16/Hexagram N`

### 覆盖范围

`allpages` 前缀枚举 Volume 16 全树共 **39 页**：1 个卷索引 + Hexagram 1–31 + Introduction/Chapter 1–3 + Plate 1–3 + Preface。卷索引页自带 `{{incomplete|scan=yes}}` 标记。

### 确认是内容缺失，不是命名规律变化

这一点专门复核过，因为 31 这个数字看起来像命名规律的断点：

- 第 31 卦页面 header 中 `next = [[../Hexagram 32|XXXII]]` —— **命名模式完全没变**，指向的就是 `Hexagram 32`，那是个红链
- 另外探测了 7 种路径模式，全部 MISSING：
  `/The Text/Section II/Hexagram 32`、`/Section II/Hexagram 32`、`/Text/Hexagram 32`、
  `/Hexagram XXXII`、`/Hexagram 32 `（尾随空格）、`/Hsien Hexagram`、`/Hexagram 33`

物理证据吻合：第 31 卦转写 djvu 157–160 页，而 `Page:` 命名空间（ns 104）对 `Sacred Books of the East - Volume 16.djvu` 的校对覆盖**正好终止在 161**。

`Page:` 层共校对 **178 / 529 页**，连续区间：
`1–5, 7–161, 168, 240–242, 246, 477–482, 523–529`

校对工作就是停在这里的。

### 象辞（Appendix II）全站不存在

象辞在原书中不在正文，单独编在 Appendix II（象传）。这是本次调查最初预警的陷阱，实测确认：

- `Sacred Books of the East/Volume 16/Appendix II` → MISSING，全树无任何 Appendix 页面
- 全站 `insource:"Treatise on the Symbolism of the Hexagrams"` → **0 命中**
- 全站 `insource:"Great Symbolism" Legge` → **0 命中**

en.wikisource 上不存在 Legge 的十翼英译。

### 1–31 卦的结构是干净的

解析规则：卦名标题后的未编号段落 = 卦辞；编号 1–6 = 六爻；第 7 段仅出现在第 1、2 卦 = 用九 / 用六。

**31 卦全部解析通过，零异常。** 第 7 段的出现位置与"只有乾坤两卦有用九用六"的既有不变量完全吻合，构成一次独立交叉验证。

### 机制差异：mainspace oldid 钉不住正文

中文那套（`scripts/verify-classical-sources.ts`）靠 mainspace `oldid` 固定版本是成立的；**英文这套不成立**。

英文页 wikitext 全文只有转写指令：

```
<pages index="Sacred Books of the East - Volume 16.djvu" from=157 to=158 onlysection="text" />
```

正文实际存放在 `Page:` 命名空间。固定 mainspace oldid 只固定了转写指令本身，正文仍随 `Page:` 页当前版本变动。若将来重启此路线，**必须改为固定 `Page:` 命名空间的 revid**（那些是不可变的）。

---

## 2. archive.org OCR —— 静默错字，且缺口区无基准可测

测了两个 item 的 `_djvu.txt` 文本层：

| item | 文件大小 | sha1（前 12 位） | 精确命中 |
|---|---|---|---|
| `mlbd.sacredbooksofeas0000fmax.vol.16` | 892,602 | `b66a98242bb3` | 179 / 219（81.7%） |
| `wg916` | 970,079 | `b766c0df67cc` | 185 / 219（84.5%） |

### 测量方法

基准 = 从 Wikisource 第 1–31 卦提取的 **219 条片段**（31 条卦辞 + 188 条爻辞段落）。

归一化：NFKD 剥离变音符 → 转小写 → 只保留 `[a-z0-9]` → 重接跨行连字符。然后做精确子串查找。**这是对 OCR 最宽容的判据**，标点、空白、大小写、变音符差异一律不计。

### 为什么"再调调解析器"救不回来

差异里最危险的不是大段错位，而是 1–3 个字符的静默错字。正文中直接观察到：

- `apprehensive` → `apprchensive`
- `Yî` → `Y7`
- `Lî` → `Lii`

这种错误读起来毫无异常，任何自动检查都发现不了。

**决定性的一点**：之所以能测出 15–18% 的缺陷率，是因为 Wikisource 提供了第 1–31 卦的可信基准。**而真正缺失的 32–64 卦没有任何基准。** 走 OCR 等于交付一份已知约 15–18% 段落含错、且无法定位哪些段落含错的译文。

### 关于"逐字节复验"的一个陷阱

对着固定 archive.org item + SHA1 做校验，在机制上完全可行。但它只能证明"与这份 OCR 转储一致"，**不能证明"与 Legge 一致"**。那是在验证错误的东西，还会制造虚假的溯源可信度——正是溯源规则要防的事。

### 一个副产品

OCR 中的 Appendix II 结构其实很干净：罗马数字后的未编号段落即大象辞，其后编号段落为小象。**说明接口映射本身是成立的**，若将来出现可信的校对文本，象辞能干净地填入，不需要发明对应关系。

---

## 3. ctext.org —— 改写版 Legge + 拦机器人

- 英译署名确为 James Legge
- **结构上最理想**：卦辞 / 象辞 / 爻辞同页齐全，是四个来源中唯一带象辞的
- API 需授权：`ERR_REQUIRES_AUTHENTICATION`
- 网页抓取约 1 页后即弹人机验证（`Please confirm that you are human`）

### 文本是被系统性改写的

用缓存到的乾卦页对第 1 卦跑基准：

| 片段 | 相似度 | 精确匹配 |
|---|---|---|
| 卦辞 | 0.635 | 否 |
| 六条爻辞 | 0.990 – 0.994 | **全部否** |
| 用九 | 1.000 | 是 |

六条爻辞全部 0.99+ 却无一精确——这不是随机噪声，是**系统性改写**：每条都把 SBE16 原文的 `line` 换成了 `NINE`（用于标记阳爻）。

### 双重淘汰

1. CAPTCHA 拦截 → 独立校验脚本无法自动重抓，溯源机制不成立
2. 文本非 1882 原文 → 标注 "Legge 1882 SBE16" 属于溯源失实

---

## 4. sacred-texts.com —— 与 ctext 同源，1.1% 精确命中

- 直连全路径 **403**，Cloudflare 硬拦，浏览器 UA 无效
- 改从 Wayback 取原始存档字节（`https://web.archive.org/web/<timestamp>id_/<url>`，快照字节不可变，**固定机制本身是成立的**）
- 存档覆盖 `ic01.htm` – `ic64.htm`，**64 页，正好一卦一页**

### 测量结果（188 条爻辞片段 vs 基准）

| 指标 | 值 |
|---|---|
| 精确匹配 | **2 条（1.1%）** |
| 平均相似度 | 0.9667 |
| ≥0.99 但不精确 | 66 条 |

原因与 ctext 相同，raw HTML 中直接可见 `NINE` 替换。**两个来源同源，是同一改写版的两个分发点，不构成互相独立的佐证。**

### 一处需要说明的测量局限

上述统计中卦辞一栏均值仅 0.021，那是**我方抽取器在该页面版式上未能定位卦辞，属 harness 缺陷，不是来源缺陷**。结论仅建立在干净抽取的 188 条爻辞片段上。

### 其他

页面仅约 2.3 KB，无 Legge 注释，**也没有象辞**。

---

## 结论与后续

**公开可得的固定来源里，不存在可逐字节复验的完整 Legge 1882。**

不干净的方式还分两类，后者更麻烦：

- archive.org 是**随机错字**——有基准时能比对发现
- ctext / sacred-texts 是**系统性编辑改写**——读起来完全通顺，挂上原书出处即为失实

因此**未交付任何部分数据**。半套经文比没有更糟：用户会看到有些卦有出处、有些没有。

### 若将来重启此路线，前置条件

1. Wikisource 志愿者把 `Page:` 校对推进到全书（含 Appendix II），且改用 `Page:` ns revid 固定；或
2. 有人拿扫描件人工校对全部约 600 条片段（64 × 卦辞 + 384 爻辞 + 2 用爻，象辞另计）

在此之前，英文站维持现方案：**引用中文原文，英文释义标为 QuickIChing 原创。**
