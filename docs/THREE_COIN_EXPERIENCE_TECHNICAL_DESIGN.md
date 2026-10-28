# Quick I Ching 三枚铜钱主流程改版技术设计文档

> 状态：与 `docs/THREE_COIN_EXPERIENCE_REDESIGN.md` 配套
> 适用范围：首页单屏体验 + 三枚铜钱主流程表现层改造
> 适用仓库：`pyxm1618/quickiching`
> 核心原则：**只重做首页与三枚铜钱体验层；现有算法、会话、卦象计算、结果、AI、账户、支付、数据库和其他起卦方式继续作为唯一业务真源。**

---

## 1. 技术目标

本技术方案只解决已经确认的产品流程：

1. 首页保持单屏主舞台。
2. 用户填写问题并点击“开始起卦”。
3. 首页宣传内容退场，问题区域移动到中央进入确认态。
4. 用户点击“开始掷币”后，问题缩成弱提示，三枚铜钱进入中央主舞台。
5. 每次由现有算法先生成并持久化权威结果，再播放与结果一致的 3D 铜钱动画。
6. 铜钱落定后展示三枚正反面、6 / 7 / 8 / 9、阴阳和动爻。
7. 用户确认“记录这一爻”后进入下一次。
8. 共六次，自下而上形成六爻。
9. 第六爻确认完成后，铜钱退场，六爻 / 卦象接管视觉中心。
10. 继续进入现有结果页、免费解读和 AI Deep Reading。

本次不建立第二套起卦系统，也不建立第二套结果系统。

---

## 2. 现有代码的唯一真源

以下现有代码继续承担业务职责，不允许在新视觉层重新实现。

### 2.1 三枚铜钱随机与爻值

继续使用：

`src/domain/casting/three-coin/algorithm.ts`

继续保持：

- yang / head = 3；
- yin / tail = 2；
- 三枚相加得到 6 / 7 / 8 / 9；
- `generateThreeCoinLine(...)` 生成 `coinFaces` 与 `lineValue`；
- 随机源继续使用现有 browser crypto 路径。

**禁止在 Three.js 场景中生成业务随机数。**

Three.js 只能读取已经生成的 `coinFaces` 并把铜钱动画落到相同结果。

### 2.2 六爻、本卦、动爻、之卦

继续使用：

`src/domain/casting/hexagrams/compute.ts`

`buildHexagramResult(...)` 仍然是统一卦象计算入口。

不允许新建另一套：

- 阴阳判断；
- 动爻判断；
- King Wen 映射；
- 之卦翻转算法。

### 2.3 三枚铜钱会话

继续使用：

`src/lib/three-coin-session.ts`

必须保留现有行为：

- 最多六爻；
- 每爻结构校验；
- 浏览器会话恢复；
- 已完成结果备份；
- 写入失败时不能把未保存结果假装成已落定；
- 写入失败后的 retry 必须保存同一个结果，不能重新随机。

### 2.4 问题状态

继续复用：

`src/components/public-reading/question-first.tsx`

以及现有 public reading session。

必须保持：

- 问题规范化；
- 最大长度规则；
- 问题隐私；
- 第一次真实起爻时锁定核心问题；
- 已经起爻后不能事后改问题；
- 免费起卦允许无问题的现有业务语义继续存在；
- 是否具备 Deep Reading 资格继续由现有业务逻辑决定。

新设计可以改变问题控件的位置和形态，但不能改变这些规则。

### 2.5 结果和 AI

继续复用现有：

- `buildPublicReading(...)`；
- `PublicReadingResult`；
- `/readings/three-coin/result`；
- `/zh/readings/three-coin/result`；
- AI Deep Reading；
- 登录、credit、entitlement、风险控制。

本次只调整进入结果时的视觉连续性。

---

## 3. 改造范围分层

### 3.1 直接复用，不改业务逻辑

以下模块原则上只调用，不重写：

- `src/domain/casting/three-coin/algorithm.ts`
- `src/domain/casting/hexagrams/compute.ts`
- `src/lib/three-coin-session.ts`
- public reading domain
- 结果页 domain
- AI Deep Reading
- Auth
- Payment
- Credit / Entitlement
- Database / Drizzle
- History
- 六十四卦内容和详情页
- 蓍草、梅花易数、手动起卦

### 3.2 允许做表现层适配

重点允许修改：

- `src/app/(default)/page.tsx`
- `src/app/(localized)/zh/page.tsx`
- `src/components/public-reading/question-first.tsx`
- `src/components/public-reading/three-coin-tool.tsx`
- 与本次体验直接相关的样式
- 三枚铜钱运行时视觉资产
- 与上述变化直接相关的测试 / browser gate

### 3.3 允许新增

只允许为本次 3D 演出增加必要组件，例如：

- `src/components/public-reading/three-coin-scene.tsx`
- 对应局部样式文件
- 必要的 Three.js scene helper

不要建立新的通用动画框架、游戏框架或全站状态框架。

---

## 4. 页面技术结构

新首页仍由 Next.js 页面负责 SEO metadata、canonical、语言和服务端静态内容入口。

实际单屏交互由 Client Component 承担。

推荐结构：

```
Home Page (Server Component)
├─ Site Header（现有）
├─ Three-Coin Home Stage（Client）
│  ├─ Landing / Hero
│  ├─ QuestionFirst（现有业务状态，做最小表现适配）
│  └─ ThreeCoinTool（现有起卦状态，做最小表现适配）
│     ├─ ThreeCoinScene（新增 Three.js 纯表现层）
│     ├─ 六爻进度 DOM
│     └─ 当前一爻结果 DOM
└─ 不再继续首页第二屏主内容流
```

不要求把整个首页改成 Client Component。

---

## 5. 状态设计：业务状态和视觉状态必须分开

### 5.1 业务状态

业务状态继续由现有组件 / session 掌握，例如：

- question
- coreQuestionAtCast
- coreQuestionFrozenAtCast
- steps
- readingMeta
- pendingStep
- unpersistedCommit
- revealedCount
- storageError
- complete

这些是事实状态。

### 5.2 新增的状态只能是表现状态

可以增加少量 UI-only stage，例如：

```ts
type ExperienceStage =
  | "landing"
  | "question-confirm"
  | "ritual"
  | "result-transition";
```

该 stage 只决定：

- 哪块 UI 显示；
- 哪块 UI 退场；
- 问题处于大输入框还是弱提示；
- 铜钱在右侧视觉位还是中央主舞台；
- 是否开始结果过渡。

**ExperienceStage 不能保存 coinFaces、lineValue、卦号或动爻。**

禁止出现“视觉层自己再维护一份六爻数据”的情况。

---

## 6. 首页各状态的精确技术行为

### 6.1 Landing

页面初始：

- Header 保持现有导航语义；
- 背景为最终确认的干净背景图；
- 主标题和短文案为 DOM；
- 问题输入框为 DOM；
- “开始起卦”为主要按钮；
- 三枚铜钱位于设计稿右侧主视觉位置；
- 此时铜钱可以使用 3D scene 的静止状态，也可以在性能降级时使用静态 / CSS fallback。

首页不继续渲染第二屏、第三屏主内容。

“每日一卦”等本次未定义功能不新增。

### 6.2 点击“开始起卦”

执行顺序：

1. 使用现有 question normalization / session 写入逻辑保存当前问题状态。
2. 不起爻，不调用 `generateThreeCoinLine(...)`。
3. ExperienceStage 进入 `question-confirm`。
4. Header 不动。
5. 背景不切换。
6. 首页标题、辅助文案淡出 / 滑出。
7. 问题输入区域移动到中央。
8. 问题文本继续完整显示。
9. 主按钮切换为“开始掷币”。

这里不创建第二个问题输入框。

如果用户仍处于第一次真实起爻之前，现有规则允许的编辑能力继续有效。

### 6.3 点击“开始掷币”

“开始掷币”表示进入真正的三枚铜钱舞台。

执行：

1. ExperienceStage 进入 `ritual`。
2. 完整问题输入框收起。
3. 问题内容转换为一行弱提示。
4. 问题弱提示继续使用 DOM，并保留隐私标记。
5. 三枚铜钱移动到中央主舞台。
6. 六爻进度出现。

第一次真正生成结果时，仍调用现有 `freezeCoreQuestion()`。

问题锁定时机不得提前到首页第一次点击“开始起卦”，否则会改变当前业务语义。

---

## 7. 每一爻的权威执行顺序

每一次起爻必须严格按照以下顺序：

```
用户触发本次掷币
    ↓
freezeCoreQuestion()（仅第一次需要）
    ↓
generateThreeCoinLine(lineIndex, browserRandomBit)
    ↓
得到权威 ThreeCoinStep
    ↓
writeThreeCoinSteps(committedSteps)
    ↓
写入成功
    ↓
ThreeCoinScene 接收同一个 coinFaces
    ↓
播放 3D 动画
    ↓
落到完全一致的三枚正反面
    ↓
DOM 展示 lineValue / 阴阳 / 动爻
    ↓
用户点击“记录这一爻”
    ↓
进入下一爻或最终结果过渡
```

### 7.1 为什么必须先写入再播放最终落定

当前代码已经有正确原则：

> cast becomes authoritative before visual settlement。

继续保持。

如果随机结果已经生成，但浏览器存储失败：

- 不显示该结果已经正式落定；
- 不重新随机；
- 保留 `unpersistedCommit`；
- retry 只重试保存同一个 step；
- 保存成功后才继续对应动画 / reveal。

---

## 8. “记录这一爻”的技术定义

产品上存在“记录这一爻”按钮，但它**不是新的业务持久化边界**。

真实结果已经在动画前由现有 session 安全写入。

“记录这一爻”只负责：

- 让用户明确看完本次三枚正反面；
- 确认视觉上的这一爻已经完成；
- 将 UI 从 `settled` 进入下一次 `idle / ready`；
- 六爻进度继续显示已经落定的数据。

禁止在“记录这一爻”按钮里：

- 再次随机；
- 重新计算 lineValue；
- 再建立另一份 steps；
- 改写已经持久化的结果。

第六爻的“记录这一爻”完成后，才进入结果视觉过渡。

---

## 9. ThreeCoinTool 的改造原则

当前 `ThreeCoinTool` 已经持有：

- `steps`
- `readingMeta`
- `revealedCount`
- `motion`
- `pendingStep`
- `unpersistedCommit`
- `storageError`
- 完成后导航
- 音效
- session restore

这些继续保留。

### 9.1 不允许重写成第二个新工具

不要创建 `NewThreeCoinToolV2` 并复制当前逻辑。

正确做法：

> 在现有 ThreeCoinTool 上增加本次首页需要的 presentation path，并把 3D renderer 下沉为纯视觉子组件。

### 9.2 MotionState

现有：

`idle | holding | casting | settled`

可以保留。

新首页不强制保留“按住摇动 · 松开起爻”作为唯一交互。

如果最终设计采用单击“开始掷币 / 掷下一爻”：

- 允许把 click 作为触发入口；
- 底层仍复用同一个生成、持久化、settlement 函数；
- Keyboard Enter / Space 仍必须可触发；
- 不能因为交互从 hold 改 click 而改变随机算法。

旧 presentation 若仍需要 hold，可以继续保留，不要求全站同步改变。

---

## 10. QuestionFirst 的最小改造

`QuestionFirst` 继续是问题业务状态拥有者。

只允许增加完成新首页演出所需的最小表现适配，例如：

- 一个明确的 home ritual presentation mode；
- 必要的 stage callback / data attribute；
- confirm 状态下的布局差异；
- ritual 状态下把完整输入框替换为弱提示；
- reset 后回到 landing。

不要：

- 抽象一个全站表单引擎；
- 新建第二套 question session；
- 改问题长度；
- 改问题隐私规则；
- 改 Deep Reading eligibility；
- 把问题写入 URL；
- 把问题写入 metadata / analytics。

现有 `data-private-question` / masking 语义继续保留。

---

## 11. Three.js 场景设计

### 11.1 依赖

当前项目没有 Three.js。

本次允许新增：

- `three`

不因为本任务引入：

- React Three Fiber
- Cannon
- Rapier
- Phaser
- Babylon
- 其他物理 / 游戏引擎

除非后续有新的明确需求，否则 plain Three.js 足够。

### 11.2 加载方式

Three.js 场景必须 client-only。

要求：

- dynamic import；
- 不进入 Server Component 执行；
- Canvas 只在需要时挂载；
- 卸载时释放 renderer、geometry、material、texture；
- 不让 WebGL 失败阻断起卦。

### 11.3 ThreeCoinScene 的输入

场景只接收视觉输入，类似：

```ts
type ThreeCoinSceneProps = {
  faces: readonly [CoinFace, CoinFace, CoinFace];
  phase: "hero" | "ready" | "casting" | "settled" | "exit";
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  reducedMotion: boolean;
};
```

可根据实现调整名字，但约束不变：

- 不传业务 random function；
- 不在 scene 内计算 lineValue；
- 不在 scene 内写 session；
- scene 不导航；
- scene 不调用 AI；
- scene 不知道 hexagram number。

### 11.4 铜钱几何

首版不要求 GLB。

程序化几何：

1. 外圆；
2. 中央方孔；
3. 有真实厚度；
4. 正面；
5. 反面；
6. 侧边金属。

推荐实现：

- 用带方孔的 Shape 形成真实轮廓；
- ExtrudeGeometry 或等价方案提供厚度 / 孔壁；
- 正面和反面分别使用两张独立 texture；
- 不把正反面画成一张 CSS sprite 冒充 3D。

### 11.5 铜钱素材

运行时至少需要：

- clean background；
- coin front PNG；
- coin back PNG。

要求：

- 透明背景；
- 正视；
- 无透视；
- 正反面方向定义固定；
- 不把动态文字、按钮、六爻烘焙进背景。

### 11.6 动画

动画必须是**受控演出**。

可以有：

- 翻滚；
- 上升；
- 下落；
- 三枚铜钱错峰；
- 轻微横向分离；
- 粒子；
- 金色轨迹；
- 落定光效。

但最终朝向必须由 `faces` 决定。

不要用真实刚体物理结果决定正反面。

如果使用随机扰动制造自然感，该随机只能影响：

- 旋转圈数；
- 微小位置；
- 粒子；
- 相机轻微变化；

不能影响业务结果。

---

## 12. 粒子和光效

首版保持轻量。

允许使用：

- Three.js Points；
- Sprite；
- additive blending；
- emissive；
- 小型 noise texture；
- 必要的轻量 shader。

Bloom 只在确认对设计还原确有必要时使用。

不要为了 Bloom 再引入一整套无关渲染框架。

粒子数量、DPR、后处理强度必须根据设备性能调整，不在文档里人为锁一个未经测试的固定数字。

---

## 13. CSS 与 WebGL 分工

### CSS / DOM

负责：

- 首页标题退场；
- 问题框移动到中央；
- 问题框收起为弱提示；
- 按钮进入 / 退出；
- 六爻进度布局；
- 结果文字；
- opacity / transform / blur；
- 页面整体状态过渡。

### Three.js

负责：

- 铜钱厚度和真实透视；
- 正反面；
- 空间翻滚；
- 金属光照；
- 三枚独立轨迹；
- 粒子 / 光轨 / 气；
- 落定效果。

不要用 Canvas 绘制正文、按钮、问题和六爻文字。

---

## 14. 六爻进度

六爻进度继续读取现有 `steps / revealedSteps`。

规则：

- 第 1 爻位于最下方；
- 第 6 爻位于最上方；
- 已落定爻不得因为动画重播改变；
- 当前正在 casting 的 step 不应提前当成“已展示完成”；
- storage 未成功时不能增加正式进度；
- 显示 6 / 7 / 8 / 9 时使用现有 line semantics；
- 6 / 9 必须清楚标识 changing。

六爻进度是 DOM，不由 Three.js 维护。

---

## 15. 第六爻与结果转场

当前 result route 继续保留。

新流程只增加视觉过渡：

1. 第六爻保存成功；
2. 动画落定；
3. 用户完成“记录这一爻”；
4. ExperienceStage → `result-transition`；
5. 铜钱和粒子退场；
6. 完整六爻成为视觉中心；
7. 使用现有完成条件确认 session 完整；
8. 导航到现有 result route；
9. Result 页面继续读取现有 reading/session 数据。

不要：

- 在首页重新实现完整结果页；
- 把结果页面逻辑复制进 ThreeCoinTool；
- 为了动画废掉 result route。

恢复到一个已经完成六爻的 session 时，继续允许现有恢复逻辑直接进入结果，不要求重新播放六次仪式。

---

## 16. 首页 SEO 的技术边界

当前首页包含大量可见 SEO 正文、FAQ 和结构化数据。

产品要求变成单屏后，不能使用以下错误方案：

- 把旧正文 `display:none` 继续留给搜索引擎；
- 把大量关键词塞进 visually hidden DOM；
- 可见 FAQ 删除后仍保留与页面内容不一致的 FAQ structured data；
- 为了过旧 gate 而让 UI 假装仍然是长页面。

正确处理：

1. metadata、canonical、hreflang 继续保留。
2. 新首页首屏保留真实可见的 H1 和必要说明。
3. 旧内容资产不删除，但可以继续存在于既有方法页、六十四卦页、指南页等正确位置。
4. 如果某个首页 JSON-LD 已不再对应可见内容，应同步调整，而不是隐藏内容作弊。
5. 只更新与新首页真实结构冲突的 SEO gate。
6. 不借本次机会重新做一轮全站 SEO。

---

## 17. Header 与一级导航

继续使用现有 Header / 导航组件和已有路由。

本次只允许为了新背景做必要视觉适配，例如：

- 透明 / 半透明背景；
- 对比度；
- hover / focus 可见性。

不改：

- 六十四卦的信息架构；
- Methods 层级；
- Guides；
- History；
- Account；
- 语言切换；
- Auth 行为。

“每日一卦”不新增。

---

## 18. 英文与中文

英文为主版本，但技术实现不得复制两套业务组件。

要求：

- 继续使用现有 dictionary / locale；
- 背景图不烘焙语言文字；
- 铜钱贴图如为传统文字，本身作为视觉资产共用；
- 英文与中文使用相同起卦逻辑、scene 和状态；
- 中文 / 英文只替换 UI copy 和必要排版宽度。

---

## 19. 移动端

Desktop 是本次视觉主验收端。

Mobile 保持相同业务流程，但允许视觉降级：

- 铜钱缩小；
- 粒子减少；
- 光效减少；
- 过渡缩短；
- 六爻进度调整位置；
- 必要时使用更简单的 Canvas / CSS fallback。

不允许移动端：

- 少起一爻；
- 省略三枚正反面；
- 改随机逻辑；
- 改问题锁定规则；
- 改结果。

---

## 20. Reduced Motion 与 WebGL Fallback

### prefers-reduced-motion

开启时：

- 不做长时间翻滚；
- 不做大范围飞行；
- 可以快速从 ready 过渡到 settled；
- 仍展示相同三枚正反面；
- 仍展示同一 lineValue；
- 仍走相同 session。

### WebGL 不可用

fallback：

- 复用 / 改造现有 CSS 铜钱视觉；
- 或静态正反面 DOM；
- 业务起卦继续完整可用。

WebGL 是否成功绝不能成为用户能不能起卦的条件。

---

## 21. 音效

现有 Web Audio 属于可选反馈，可以继续复用。

规则：

- 声音关闭时完全不影响流程；
- AudioContext 失败不影响流程；
- 新动画时间变化时只调整音效时机；
- 不新增音频资源依赖，除非设计明确要求。

---

## 22. 运行时资产位置

文档参考图继续放在：

`docs/assets/`

真正网页运行时的背景 / 铜钱贴图应进入正常 public asset 目录，例如：

```
public/
  three-coin/
    background.*
    coin-front.png
    coin-back.png
```

最终实际文件名以提供的素材为准。

不要让页面运行时依赖 `docs/assets`。

---

## 23. 性能要求

必须做到：

- Three.js 动态加载；
- 不阻塞首屏文本 / 输入框可交互；
- renderer 只创建一次；
- resize 不反复重建 scene；
- texture 只加载一次并复用；
- 页面卸载时 dispose；
- 对 devicePixelRatio 做合理上限；
- 页面进入后台时避免无意义高频渲染；
- 无动画时尽量降低 render loop 成本；
- mobile 自动降低视觉负载。

不要为了视觉效果引入与本任务无关的大型依赖。

---

## 24. 可访问性

Canvas 只做视觉，设置为不承担业务语义。

真实语义必须存在于 DOM：

- 当前第几爻；
- 三枚正 / 反；
- 6 / 7 / 8 / 9；
- 阴 / 阳；
- 是否动爻；
- 按钮状态；
- 错误状态。

要求：

- 键盘可以完成整个起卦；
- focus 状态可见；
- motion reduced 可用；
- Canvas 失败仍可用；
- 颜色不能是动爻的唯一信息。

---

## 25. 错误处理

### Browser storage error

继续沿用当前 fail-safe：

- 阻止继续正式起爻；
- 展示明确错误；
- 如果已有 `unpersistedCommit`，retry 同一个结果；
- 不 reroll。

### Three.js load error

只降级视觉：

- 捕获错误；
- fallback CSS / DOM coins；
- 不修改 session；
- 不修改 result。

### Texture load error

- fallback 到基础金属材质 / CSS coin；
- 不阻断业务。

---

## 26. 测试范围

### 26.1 必须保留的现有测试

现有：

- three-coin algorithm；
- hexagram compute；
- session validation；
- public reading；
- result；
- SEO / browser gate；

不能因视觉重构失效而直接删除。

### 26.2 新增 / 更新的必要测试

只增加本次流程直接需要的覆盖：

1. 首页初始只显示确认的主舞台内容。
2. “开始起卦”不生成任何爻。
3. “开始起卦”后问题仍存在并进入确认态。
4. 第一次真正掷币时问题才锁定。
5. 一次 cast 只调用一次权威随机生成。
6. scene 最终 faces 与 authoritative `ThreeCoinStep.coinFaces` 一致。
7. storage 写入失败不会 reveal / reroll。
8. retry 保存同一个 step。
9. 六爻顺序 bottom-up。
10. settled 后“记录这一爻”不重新计算结果。
11. 第六爻确认后才进入结果转场。
12. 已完成 session restore 仍可正确进入 result。
13. reduced motion 可完成六次。
14. WebGL fallback 可完成六次。
15. 英文 / 中文走同一业务路径。
16. 问题不进入 URL、metadata 或非必要 analytics。

### 26.3 视觉验收

静态关键状态按设计稿比较：

- Landing；
- Question Confirm；
- Casting；
- Settled；
- Six-line progress；
- Result transition。

以原始设计稿画布对应的 Desktop viewport 为基准。

如果设计稿原始 viewport 尚未明确，不允许开发者自行宣称“像素级通过”；应先确认设计画布尺寸。

动画没有视频 / Motion Reference 时，只验收：

- 起点；
- 终点；
- 层级；
- 节奏合理；
- 不违背已确认视觉风格。

不能声称静态图已经定义了唯一运动轨迹。

---

## 27. 实施顺序

严格按以下顺序，避免同时改太多层：

### Phase 1：页面骨架

- 首页收敛为单屏；
- 保留 Header；
- 完成 landing → question-confirm → ritual 的 DOM / CSS 状态；
- 暂时可继续使用现有 coin fallback。

### Phase 2：接回现有业务

- QuestionFirst；
- ThreeCoinTool；
- session restore；
- storage error；
- 六次起爻；
- result navigation。

先保证新布局下业务完整正确。

### Phase 3：Three.js 铜钱

- 引入 `three`；
- 新建 scene；
- 使用正反面素材；
- 接入 authoritative coinFaces；
- 完成 hero / ready / casting / settled / exit。

### Phase 4：粒子与视觉精修

- 粒子；
- 光效；
- 气流；
- 关键帧对齐。

不在业务尚未正确前先堆视觉特效。

### Phase 5：性能、降级、验收

- reduced motion；
- WebGL fallback；
- mobile；
- resource disposal；
- browser / SEO gate；
- Design screenshot 对比。

---

## 28. 明确禁止的技术扩散

本次不允许：

- 重写三枚铜钱算法；
- 新增服务器随机 API；
- 新建数据库表；
- 新增 migration；
- 重写 public reading；
- 重写结果页 domain；
- 重写 AI；
- 改支付；
- 改 credit；
- 改登录；
- 改 History；
- 重做六十四卦；
- 重做蓍草；
- 重做梅花易数；
- 重做手动起卦；
- 新增“每日一卦”；
- 引入物理引擎；
- 引入完整游戏引擎；
- 建全站动画框架；
- 为本任务重构全站状态管理；
- 复制一套 V2 ThreeCoinTool；
- 在 Canvas 内重做全部 UI；
- 隐藏 SEO 长文只给爬虫；
- 为制造 diff 修改无关文件。

---

## 29. 最终技术边界

本次正确实现应满足：

> **现有业务系统继续决定“问了什么、掷出了什么、保存了什么、形成什么卦、展示什么结果”；新代码只负责把这些既有事实，以已确认的一屏流程和 3D 三枚铜钱演出呈现出来。**

判断任何技术改动是否应该进入本次开发，只问一个问题：

> **如果去掉新视觉，这段代码是否在重新定义 Quick I Ching 的业务？**

如果答案是“是”，默认超出本次范围。

如果答案是“否”，并且它直接服务于首页单屏、问题确认、三枚铜钱演出、六爻进度或结果视觉衔接，才属于本次范围。
