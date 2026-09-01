# 在 Vercel 上接第三方 AI 供应商（以 DeepSeek 为例）

2026-09-01 从 Vercel AI Gateway 迁到 DeepSeek 直连的完整记录。
写给下一次遇到同类问题的人——包括「该不该迁」的判断，而不只是「怎么迁」。

---

## 先判断：你真的需要迁吗

触发这次迁移的是这条报错：

```
AI Gateway requires a valid credit card on file to service requests.
```

**关键认知：这个门槛在网关本身，与用哪个模型无关。** 曾经以为「Gateway 支持
DeepSeek，所以换个模型名就行」——不成立。三种组合只有两种存在：

| 方案 | 改代码 | 需绑卡 | 适用 |
|---|---|---|---|
| Gateway + 任意模型 | 否 | **是** | 愿意绑卡；想统一计费/观测 |
| 直连第三方 | 是（很小） | 否 | 不便绑卡；成本敏感 |
| ~~不改代码 + 不绑卡~~ | — | — | **不存在** |

如果只是想省钱而绑卡没有障碍，先走 Gateway 换模型，代价最小。

---

## 迁移工作量：比想象的小

实际改动 **3 处编辑 + 1 个依赖**：

```ts
// src/server/generation/ai-sdk-provider.ts
- const [{ generateText, Output }, { createGateway }] = await Promise.all([
-   import("ai"), import("@ai-sdk/gateway"),
- ]);
- const gateway = createGateway(gatewayOptions(env));
+ const [{ generateText, Output }, { createDeepSeek }] = await Promise.all([
+   import("ai"), import("@ai-sdk/deepseek"),
+ ]);
+ const gateway = createDeepSeek(gatewayOptions(env));
```

`createDeepSeek({ apiKey, baseURL })` 与 `createGateway` 签名一致，
`provider.languageModel(id)` 也一致，所以调用点完全不用动。

### 为什么这么小：两个可迁移性特征

1. **手写的 OpenAI 兼容调用零改动。**
   `src/server/ai/personalized-gateway.ts` 直接 `POST {base}/chat/completions`，
   带 `Authorization: Bearer`、`model`、`messages`、`response_format`。
   DeepSeek 原生支持这套协议，**只改环境变量即可迁移**。
   → 启示：手写 OpenAI 兼容 HTTP 反而比 SDK 更容易换供应商。

2. **错误分类用 duck typing 而非 instanceof。**
   `classifyGenerationError` 读的是 `statusCode` / `status` / `message` 关键词 /
   `isRetryable`，没有 `instanceof GatewayXxxError`。换供应商后照常工作。
   → 启示：**跨供应商的错误处理不要绑定具体 SDK 的异常类**。

---

## 模型选型：别只看便宜，也别只信简化测试

DeepSeek 实际可用模型（`GET /v1/models`，别猜）：

```
deepseek-v4-flash        ← deepseek-chat 这个别名当前指向它
deepseek-v4-pro
deepseek-v4-flash-vision-exp
```

**别用 `deepseek-chat` 这类别名**：它只是指针，日后可能漂移到别的模型，
而模型一换，遵从性表现就变了。配置里写显式 ID。

### 实测数据（同一 prompt、同一严格校验）

| 模型 | 简化 prompt | 生产 prompt | 耗时 | tokens |
|---|---|---|---|---|
| flash | 8/8 通过 | **2 次挂 1 次** | 13–71s | 2000–8000 |
| pro | 5/5 通过 | 待观察 | 33–78s | 2400–5500 |

**最重要的一条教训：简化 prompt 的测试会给出过于乐观的结论。**
本项目的生产 prompt 很长——五条编号规则、体用框架、模块权重、引用约束。
flash 在简化 prompt 下 8/8，在生产 prompt 下却失败了。
**长上下文 + 多约束会显著降低小模型的指令遵从性，而简化探针测不出这一点。**

因此最终采用分层配置：

```
AI_MODEL_DEEP_READING    = deepseek-v4-pro     # 付费产出，强约束长 prompt
AI_MODEL_PREVIEW         = deepseek-v4-flash   # 短任务，flash 足够
AI_MODEL_OUTPUT_REVIEW   = deepseek-v4-flash   # 只输出几个字段
```

### 排查时我犯过的两个错，都值得记住

1. **误判为「繁简假阳性」。** 曾以为校验失败是模型把繁体原文写成简体所致
   （校验器做纯字符串包含比对）。查证后发现生产数据本就是简体
   （`"乾：元亨。利贞。"`），是**探针自己用了繁体原文**造出的假象。
   → 探针的输入必须与生产数据同源，否则测的是自己造的问题。

2. **误判为「prompt 漏了约束」。** 曾以为加一句「不得添加额外字段」即可，
   查证后发现生产 prompt 早有该约束，且更严格——连「引号只能用于引用、
   不得用于强调」都明写了。
   → 下结论前先读生产 prompt，别拿探针的简化版当真相。

### 函数执行时长（Hobby 计划的硬约束）

WDK 自动为 workflow 路由配置：

```
step.func → maxDuration: max   （AI 调用在这里，Hobby 上即 60s）
flow.func → maxDuration: 60
```

pro 有一次跑到 78s，会超时。可接受的理由：5 次中 4 次在 51s 内，且 step 自带
3 次重试。若超时频发，选项是升级计划（Pro 为 300s）或换更快的模型。

---

## 环境变量：改名还是复用

本次**保留了 `AI_GATEWAY_*` 三个名字**，只改值：

```
AI_GATEWAY_API_KEY       = <DeepSeek key>          (sensitive)
AI_GATEWAY_BASE_URL      = https://api.deepseek.com/v1  (encrypted)
AI_SDK_GATEWAY_BASE_URL  = https://api.deepseek.com/v1  (encrypted)
AI_MODEL_PREVIEW / AI_MODEL_DEEP_READING / AI_MODEL_OUTPUT_REVIEW = deepseek-chat
```

理由：这三个名字是 `capabilities.ts` 里声明的**能力依赖项**，改名会连带
改动能力矩阵和至少 4 个测试文件的 fixture。代价大于收益，改为在
`gatewayOptions()` 上写注释说明「gateway 现在指 DeepSeek」。

> 若新项目从零开始，建议用中性命名（如 `AI_PROVIDER_API_KEY`），
> 避免把某一家供应商的名字焊进能力矩阵。

注意两个 base URL 都要带 `/v1`：手写调用会拼 `/chat/completions`。

---

## 最大的坑：结构化输出是「兼容模式」

迁移后 AI SDK 会发这条警告，**它比它看起来重要得多**：

```
The feature "responseFormat JSON schema" is used in a compatibility mode.
JSON response schema is injected into the system message.
```

含义：**DeepSeek 没有原生严格 JSON Schema 模式**。AI SDK 把 schema 塞进
system message，靠模型自觉遵守——**合规性从「API 强制」降级为「模型尽力」**。

如果调用点是 `maxRetries: 0`（本项目就是），一次不合规就直接失败。

### 因此：迁移前必须实测，别直接部署

一轮 Vercel 部署 16–20 分钟，本地实测 30 秒。写个探针跑真实 API：

```ts
const result = await generateText({
  model: deepseek.languageModel("deepseek-chat"),
  system, prompt,
  output: Output.object({ schema: 真实的业务 schema }),
  maxRetries: 0,
  maxOutputTokens: 16000,
});
if (!result.output) { /* 生产会抛 AI_SCHEMA_INVALID */ }
const parsed = 真实schema.safeParse(result.output);  // 二次严格校验
```

要点：
- 用**真实的业务 schema**，不要简化版
- **多用例**覆盖不同语言、不同枚举取值
- 断言**枚举字段没被模型改写**（本项目的 `verdictEcho` 必须回显输入的判词，
  模型擅自改写就意味着它在重新决定结论——这是正确性问题，不是格式问题）

本次实测 5/5 通过：schema 合规、verdictEcho 从未被改写、中英文均可、
4–10 秒、700–1200 tokens/次。

**但 5 次不能证明长期稳定。** 兼容模式的失败是概率性的，需要在生产观察
`AI_SCHEMA_INVALID` 的发生率。若出现，可考虑：给这类调用允许 1–2 次重试、
或简化 schema、或换用原生支持严格 schema 的模型。

---

## 观察到但未定论：中文输出偏短

实测中英文字段长度差异明显（英文最长 413–583 字符，中文 51–145 字符）。
探针用的是简化 prompt，真实 prompt 更详细，未必如此。
**人工验收时应重点检查中文深度解读的篇幅是否达到产品要求。**

---

## 排查手法（比结论更值得复用）

1. **让错误可区分，再去查因。** 路由的兜底 `catch` 把所有未知错误压成同一个
   `DEEP_READING_FAILED`，导致完全无法定位。先把已知失败映射成独立错误码，
   下一次运行就自己说出了 `WORKFLOW_START_FAILED`。
   → 可观测性改造往往是排查的**第一步**，不是最后一步。

2. **Hobby 计划不保留运行时日志**，`vercel logs` 会返回 "No logs found"。
   替代手段：`npx workflow inspect run <runId> --backend vercel --project <p> --team <t>`
   ——它给出了完整的步骤级错误和堆栈，正是靠它拿到那句 credit card 报错。
   注意 run 数据 24 小时后过期（`expiredAt`）。

3. **CLI 的 `--json` 输出混着 debug 行**，且顶层键是 `data` 而非 `runs`。
   解析时先逐行定位第一个以 `{` 开头的行。

---

## 相关文件

- `src/server/generation/ai-sdk-provider.ts` — SDK 路径的 provider 构造
- `src/server/ai/personalized-gateway.ts` — 手写 OpenAI 兼容路径
- `src/server/generation/boundary.ts` — `classifyGenerationError`，跨供应商通用
- `src/server/capabilities.ts` — 能力依赖矩阵，改环境变量名必须同步这里
