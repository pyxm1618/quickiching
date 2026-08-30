# 发布手册 · Commercial V2

面向执行部署的人。Public SEO V1 的发布不需要本文档——它没有数据库和能力开关。

## 1. 迁移必须手动执行，构建不会替你跑

`vercel.json` 的 `buildCommand` 是 `node scripts/vercel-build.mjs`，**其中不包含任何迁移步骤**（已核实）。构建只跑 lint / typecheck / test / build 和一系列浏览器与 Lighthouse 闸门。

所以顺序是固定的：

```bash
# 1. 先迁移，用不带连接池的 URL
MIGRATION_DATABASE_URL='postgresql://...' bun run db:migrate

# 2. 确认迁移元数据一致
bunx drizzle-kit check

# 3. 再部署
```

**为什么迁移要用 `MIGRATION_DATABASE_URL` 而不是 `DATABASE_URL`：** 运行时用的是连接池 URL，池化连接会拒绝 drizzle 迁移需要的会话级操作。两者可以指向同一个库，但迁移那条必须是 unpooled。

**迁移必须先于部署。** 新代码假设新列存在；反过来（先部署后迁移）会在这个窗口内产生运行时错误。反之，旧代码遇到新列是安全的——迁移都是加列，不删���改。

### 加迁移时的连锁反应

`src/server/readiness/readiness-service.ts` 里的 `REQUIRED_MIGRATION_CHECKPOINT_AT` 必须同步更新为 `drizzle/meta/_journal.json` 里最大的 `when`。有测试会断言这一点，不同步会红。这是刻意的：不更新的话，一个漏掉了新迁移的部署仍会报告 ready。

## 2. 能力开启顺序

六个能力有依赖关系，代码里声明在 `src/server/capabilities.ts`：

| 能力 | 开关 | 依赖 |
| --- | --- | --- |
| `auth` | `COMMERCIAL_V2_AUTH_ENABLED` | — |
| `webhookIngestion` | `COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED` | — |
| `reconcile` | `COMMERCIAL_V2_RECONCILE_ENABLED` | — |
| `aiPreview` | `COMMERCIAL_V2_AI_PREVIEW_ENABLED` | auth |
| `paidDeepReading` | `COMMERCIAL_V2_PAID_DEEP_READING_ENABLED` | auth, reconcile |
| `checkout` | `COMMERCIAL_V2_CHECKOUT_ENABLED` | auth, webhookIngestion, reconcile |

依赖���满足时该能力**保持关闭**，不会报错也不会半开。因此开启顺序：

```
1. DATABASE_ADAPTER_MODE=postgres + DATABASE_URL   （所有能力的前提）
2. auth
3. webhookIngestion + reconcile                     （收款前必须先能收 webhook 和对账）
4. paidDeepReading + aiPreview
5. checkout                                          （最后开——先确保钱进来后有东西处理）
```

**checkout 放最后**是有意的：先具备处理付款的能力，再开放收款。反过来会出现"用户付了钱但 webhook 收不了、credits 发不出"的局面。

### 验证

每步之后查 `/api/ready`：

```bash
curl -s https://<host>/api/ready | jq
```

- `status: "ready"` 要求**六个能力全部启用** + 数据库可达 + 全部必需表存在 + 迁移日志达到检查点
- 任一能力未启用即 `not_ready`。半开的商业面不是可交付状态，这是刻意的
- 响应里 `capabilities.<name>.missingDependencies` / `invalidDependencies` 会指出缺什么
- 响应**不含任何密钥值**，可以安全贴进工单（有测试保证）

`/api/health` 是轻量存活检查，不做能力判断。

## 3. 回滚

### 首选：关能力，不回滚代码

能力开关是**运行时环境变量**，改完重新部署即可，不需要回滚代码。出问题时最快的止血是把对应能力关掉：

```
COMMERCIAL_V2_CHECKOUT_ENABLED=false      # 停止收款
COMMERCIAL_V2_PAID_DEEP_READING_ENABLED=false   # 停止消耗 credits
```

关闭后 `src/middleware.ts` 会在边缘层直接返回 404/410，请求到不了业务代码。已发放的 credits 不受影响，已付款订单仍会被 webhook 正常处理（只要 `webhookIngestion` 还开着——**止血时不要关它**，否则 Waffo 的重投会全部失败）。

### 代码回滚

Vercel 的 Instant Rollback 回到上一个部署。注意：

- **迁移不回滚。** 所有迁移都是加列，旧代码不会因为多了列而失败
- 如果新迁移带了 `not null` 无默认值的列，旧代码的插入会失败——目前没有这样的迁移，将来加时必须给默认值

### 支付出问题时不要做的事

不要手工改 `payment_orders` 或 `entitlement_batches`。发放路径有幂等键（`entitlement_ledger.business_key`）和事务保证，手工干预会让对账作业与实际状态不一致。走 `/api/internal/reconcile` 或等它自己跑。

## 4. 对账作业

`vercel.json` 配置为每小时第 17 分执行 `/api/internal/reconcile`。

- 用非零分钟是为了避开整点的集中调度
- **每小时需要 Vercel Pro**。Hobby 计划限制 cron 每天一次；如果部署报 cron 频率错误，说明计划不匹配，此时要么升级计划，要么改回 `0 0 * * *` 并接受最长 24 小时的支付异常发现延迟
- 作业用相对时间窗（10 分钟）判定滞留记录，且发放走 `on conflict do nothing`，因此提高频率是安全的，重复执行不会重复发放
- 鉴权用 `CRON_SECRET`，`Authorization: Bearer <secret>`，常量时间比较

手动触发（排障用）：

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/internal/reconcile | jq
```

## 5. 密钥轮换

六组密钥格式均为 `version:key,version:key`（新版本在前）：

`SESSION_SIGNING_KEYS`、`QUESTION_FINGERPRINT_KEYS`、`QUESTION_ENCRYPTION_KEYS`、`RESULT_INTEGRITY_KEYS`、`ANONYMOUS_OWNER_KEYS`、`PAYMENT_CHECKOUT_URL_KEYS`

- 每组的密钥值必须在六组之间**全局唯一**，启动校验会拒绝重复
- 轮换方式是 `v2:new,v1:old`——旧版本要保留到用它加密的数据全部过期为止
- `PAYMENT_CHECKOUT_URL_KEYS` 首次启用时必须用现有 `APP_SECRET` 材料作为 v1，否则未过期的 checkout URL 会解不开

## 6. 部署前检查清单

```bash
bun install --frozen-lockfile
bun run lint && bun run typecheck && bun run test
bunx drizzle-kit check
bun run test:postgres:serial      # 需要本机 PostgreSQL 16 工具链
```

部署后：

```bash
curl -s https://<host>/api/health | jq
curl -s https://<host>/api/ready  | jq '.status, .database.status'
```
