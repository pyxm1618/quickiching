# Commercial V2 人工验收清单

**用途：** 自动化闸门（`scripts/commercial-v2-staging-gate.mjs`）覆盖不到的那一环。
**频率：** 每次开量前跑一次，对 **Waffo test 环境** 执行。
**状态：** 与 `docs/RELEASE_RUNBOOK.md` 配套。跑完把结果贴进发布工单。

---

## 为什么必须有人工环节

三件事在技术上无法自动化，且**不允许为了自动化而放宽**：

1. **真实付款。** 脚本无法在 Waffo 收银台完成一笔付款。
2. **webhook 投递。** `src/server/payments/waffo-webhook.ts` 的 `verifyWebhook` 用 Waffo 的**公钥**验签。我们不持有私钥，签不出合法事件。这是正确的设计——代价是 CI 里造不出真 webhook。**不要为测试加验签开关。**
3. **登录。** Better Auth 走 Google OAuth 或邮件魔链，脚本拿不到浏览器会话。

自动化闸门用**直接播种 staging 数据库**的方式绕开这三项的*前置条件*（账号、会话、credits），从而验证下游链路。但「钱真的进来了 → webhook 真的到了 → credits 真的发了」这一段，只有人能跑。

**这份清单不跑完，下单到发放的链路就没有被端到端验证过。**

---

## 前置条件

- staging 已按 `RELEASE_RUNBOOK.md` 第 2 节的顺序开启六个能力，`GET /api/ready` 返回 `status: "ready"`
- `WAFFO_ENVIRONMENT=test`
- 自动化闸门已通过：`node scripts/commercial-v2-staging-gate.mjs`（先跑它，它会暴露掉大部分配置问题）
- 手上有 staging 数据库的只读连接，以及一个可登录的测试账号

下文所有 SQL 都对 staging 库执行。记录下你的 `<user_id>` 和 `<order_id>`，后面几步要连着用。

---

## 1 · 用 Waffo test 环境完成一笔真实付款

**怎么做**

1. 用测试账号登录 staging（Google OAuth 或魔链）。
2. 进入购买入口，选 **one**（1 次解读 / USD 2.99）——单次产品让第 4 步的余额断言最容易看清。
3. 记下页面发起结算前的时间点。
4. 在 Waffo test 收银台用 Waffo 文档提供的测试卡完成付款。

**查什么**

```sql
select id, status, product_key, quantity, amount_minor, currency,
       provider_environment, provider_order_id, provider_payment_id, paid_at
from payment_orders
where user_id = '<user_id>'
order by created_at desc
limit 3;
```

**期望看到**

- 最新一行 `status = 'paid'`，`paid_at` 非空，`refunded_at` 为空
- `product_key = 'one'`、`quantity = 1`、`amount_minor = 299`、`currency = 'USD'`
- `provider_environment = 'test'` —— **如果这里是 `prod`，立即停止**，说明 staging 指向了生产收单
- `provider_order_id` / `provider_payment_id` 均已回填

**如果 `status` 停在 `checkout_created`：** webhook 没到或没处理，直接跳到第 2 步排查，不要重复下单。

---

## 2 · 确认 webhook 送达

**怎么做**

付款完成后等 30 秒，然后查 inbox。

**查什么**

```sql
select id, event_type, event_id, delivery_id, status, attempt_count,
       replay_count, last_error_code, signature_verified_at, processed_at
from payment_webhook_inbox
where order_merchant_external_id = '<order_id>'
   or linked_order_id = '<order_id>'
order by created_at desc;
```

**期望看到**

- 至少一行 `event_type = 'order.completed'`
- `signature_verified_at` 非空 —— 这是验签通过的证据；**没有这一列就意味着没有任何事件真正入库**
- `status = 'processed'`，`processed_at` 非空
- `last_error_code` 为空

**如果 `status = 'received'` 或 `'processing'` 持续超过 2 分钟：** outbox 工作流没起来。查第 3 步的 `payment_outbox`，并手工触发对账：

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<staging-host>/api/internal/reconcile | jq
```

**如果 inbox 里一行都没有：** 事件根本没到，去 Waffo 后台看投递日志。此时**不要**怀疑验签——验签失败会入 `payment_webhook_conflicts` 或直接 401，都不是「零行」。

---

## 3 · 确认 outbox 处理并发放 credits

**怎么做**

顺着第 2 步的 `inbox_id` 查 outbox 与账本。

**查什么**

```sql
select id, inbox_id, order_id, topic, status, attempt_count,
       last_error_code, completed_at
from payment_outbox
where order_id = '<order_id>';

select id, batch_id, order_id, action, quantity, business_key, created_at
from entitlement_ledger
where order_id = '<order_id>'
order by created_at;

select id, quantity_total, quantity_available, quantity_reserved,
       quantity_consumed, quantity_revoked, expires_at
from entitlement_batches
where order_id = '<order_id>';
```

**期望看到**

- outbox：`topic = 'grant_entitlement'`，`status = 'completed'`，`completed_at` 非空
- 账本：**恰好一行** `action = 'grant'`，`quantity = 1`，`business_key` 形如 `grant:<order_id>`
- 批次：**恰好一行**，`quantity_total = 1`（等于订单的 `quantity`，由触发器强制）、`quantity_available = 1`，其余计数为 0，`expires_at` 约在 12 个月后

**如果账本有两行 `grant`：** 不可能——`entitlement_ledger_order_action_once_idx` 会挡住。真出现了就是索引缺失，属于严重问题，停止开量。

---

## 4 · 确认 `/account` 显示的余额与库中一致

**怎么做**

用同一个账号打开 `/account`，读页面上的可用次数。

**查什么**

```sql
select coalesce(sum(quantity_available), 0)::integer as available,
       coalesce(sum(quantity_consumed), 0)::integer as consumed
from entitlement_batches
where user_id = '<user_id>' and expires_at > clock_timestamp();
```

**期望看到**

- 页面显示的可用次数 **等于** `available`
- 刚付完一笔 one，且此前余额为 0 时，两边都应是 `1`

注意查询里的 `expires_at > clock_timestamp()`：页面只算未过期批次。如果两边对不上，先确认是不是有已过期批次被你算进去了，再怀疑代码。

---

## 5 · 确认重复投递同一事件不会重复发放

**怎么做**

在 Waffo 后台对第 1 步那笔订单的 `order.completed` 事件点**重投（redeliver）**。等 30 秒。

**查什么**

```sql
select id, event_id, delivery_id, status, replay_count, last_replay_reason
from payment_webhook_inbox
where order_merchant_external_id = '<order_id>'
order by created_at;

select action, quantity, business_key from entitlement_ledger
where order_id = '<order_id>' order by created_at;

select quantity_total, quantity_available from entitlement_batches
where order_id = '<order_id>';
```

**期望看到**

- 账本**仍然只有一行** `grant`，`quantity` 不变
- `quantity_available` **没有增加**
- inbox 侧要么仍是原来那一行（`replay_count` 递增），要么新增一行且很快变为 `processed`/`ignored`——**但账本不能动**

幂等由两处保证：`payment_inbox_business_event_idx`（同一 `event_type` + `event_id` 唯一）与 `entitlement_ledger.business_key` 唯一 + `on conflict do nothing`。这一步是在真实投递路径上验证它们确实生效。

**如果余额变成 2：** 立刻按 `RELEASE_RUNBOOK.md` 第 3 节关闭 `COMMERCIAL_V2_CHECKOUT_ENABLED` 止血，**不要手工改表**。

---

## 6 · 确认退款与拒付各自走对了路径

> **注意：这一项与「退款一律进人工复核」的直觉不同，请按代码的实际行为验收。**
>
> `src/server/payments/postgres-repository.ts:566-569` 决定 outbox topic：
> `manualReviewReason` 非空 → `financial_review`；否则 `order.completed` → `grant_entitlement`，其余（即 `refund.succeeded`）→ `revoke_entitlement`。
> 而 `manualReviewReason` 只对 **`chargeback.*` / `dispute.*`** 事件置位（`waffo-webhook.ts:179`，值为 `CHARGEBACK_POLICY_UNRESOLVED`）。
>
> 也就是说：**一笔干净的退款会被自动撤销 credits，不进人工复核；进人工复核的是拒付/争议，以及与订单对不上的畸形退款。**

### 6a · 干净退款 → 自动撤销

**怎么做**：在 Waffo test 后台对第 1 步的订单发起**全额退款**，等 60 秒。

**查什么**

```sql
select status, refunded_at from payment_orders where id = '<order_id>';

select topic, status, last_error_code from payment_outbox where order_id = '<order_id>';

select action, quantity, business_key from entitlement_ledger
where order_id = '<order_id>' order by created_at;

select quantity_available, quantity_revoked from entitlement_batches
where order_id = '<order_id>';
```

**期望看到**

- 订单 `status = 'refunded'`，`refunded_at` 非空
- outbox 新增 `topic = 'revoke_entitlement'`，`status = 'completed'`
- 账本新增**一行** `action = 'revoke'`
- `quantity_available` 归 0，`quantity_revoked = 1`
- `/account` 上的余额同步归 0

**边界：如果这次退款前 credits 已被消耗**，撤销无法从已消费的额度里扣回。此时应落到 `payment_financial_reviews` 而不是把批次算成负数。确认 `entitlement_batches_identity_check`（四个计数之和必须等于 `quantity_total`）没有被违反——它违反不了，事务会回滚。

### 6b · 拒付/争议 → 人工复核，不自动处理

**怎么做**：在 Waffo test 后台对一笔新订单触发 `chargeback.*` 或 `dispute.*` 事件（Waffo test 环境支持模拟；若不支持，此项标注为「本轮未验证」并说明原因，**不要伪造事件**）。

**查什么**

```sql
select id, event_type, status from payment_webhook_inbox
where order_merchant_external_id = '<order_id_2>';

select topic, status from payment_outbox where order_id = '<order_id_2>';

select id, order_id, inbox_id, reason_code, status, resolved_at
from payment_financial_reviews
where order_id = '<order_id_2>';

select action from entitlement_ledger where order_id = '<order_id_2>';
```

**期望看到**

- outbox `topic = 'financial_review'`
- `payment_financial_reviews` 新增一行，`reason_code = 'CHARGEBACK_POLICY_UNRESOLVED'`，`status = 'open'`，`resolved_at` 为空
- 账本**没有**新增 `revoke` 行 —— 拒付不自动撤销，等人来判

---

## 收尾

跑完把下面这张表填进发布工单：

| 步骤 | 结果 | 证据（订单号 / 时间戳 / 查询输出） |
| --- | --- | --- |
| 1 真实付款 | pass / fail | |
| 2 webhook 送达 | pass / fail | |
| 3 credits 发放 | pass / fail | |
| 4 `/account` 余额一致 | pass / fail | |
| 5 重投不重复发放 | pass / fail | |
| 6a 干净退款自动撤销 | pass / fail | |
| 6b 拒付进人工复核 | pass / fail / 未验证 | |

**任何一项 fail 都不得开量。** 「未验证」必须写清原因——它不等于 pass。

### 清理

test 环境的数据不必删。**不要**手工清理 `payment_orders` / `entitlement_batches` / `entitlement_ledger`：账本与审计表由触发器强制只追加（`prevent_entitlement_ledger_mutation`、`prevent_audit_events_mutation`），删不掉，硬删只会让对账作业与实际状态错位。这与 `RELEASE_RUNBOOK.md` 第 3 节「支付出问题时不要做的事」是同一条纪律。
