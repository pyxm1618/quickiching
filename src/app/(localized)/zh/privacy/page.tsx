import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隐私政策 | Quick I Ching",
  description: "说明 Quick I Ching 如何处理浏览器数据、账户数据、分析与广告、技术日志和支持消息。",
  robots: { index: false, follow: true },
};

export default function ChinesePrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">法律与隐私</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">隐私政策</h1>
      <p className="mt-4 text-sm text-[var(--ink-3)]">最后更新：2026 年 9 月 23 日</p>

      <h2 className="mt-10 font-display text-2xl font-medium">公开起卦数据</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">公开的三枚铜钱、蓍草、梅花易数和手动起卦工具不要求账户或付款。起卦进度与固定的方法事实可能保存在浏览器会话存储（<code>sessionStorage</code>）中，使当前起卦在页面刷新后仍可恢复。只有当你明确选择保存时，浏览器才会把记录写入仅限本机的本地存储（<code>localStorage</code>）历史；它不属于账户历史或云同步。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">账户与付费解读数据</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">当商业账户功能已启用且你登录后，Quick I Ching 会保存提供这些功能所需的账户、起卦状态、权益和支付状态。支付由第三方支付合作方 Waffo 安全处理，Quick I Ching 不存储原始银行卡信息。如果问题与账户起卦记录关联，问题文本会以带版本的加密密钥在服务器端加密保存。付费深度解读输出、订单记录与退款处理状态会保存在服务器端，用于交付解读、维护可用次数、处理符合条件的退款并防止重复扣费。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">托管与技术日志</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">与多数网站一样，托管和网络服务商可能处理常规请求信息，例如 IP 地址、浏览器信息、请求网址、时间戳以及安全或可靠性日志。这些记录可用于提供站点服务、防止滥用、诊断故障和履行法律义务。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">分析与会话体验</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching 使用 Google Analytics 4 了解流量来源、页面浏览和汇总使用情况，并使用 Microsoft Clarity 了解点击、滚动、热力图和会话层面的体验。站点默认把分析和广告存储初始化为拒绝；在服务支持的情况下，如果没有有效同意信号允许额外存储，这些服务可能以受限的无 Cookie 模式运行。相关处理同时受 Google 与 Microsoft 各自适用的隐私条款约束。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">广告</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">三枚铜钱结果页可能展示由 Adsterra 提供的原生横幅广告。加载广告会使你的浏览器连接到 Adsterra 的投放基础设施，包括 effectivecpmnetwork.com。广告提供方可能接收常规网络和设备信息，例如 IP 地址、浏览器或设备特征、请求页面、时间戳和广告互动数据，并可能依照其自身隐私条款使用 Cookie 或类似技术。广告与 Quick I Ching 的解读内容、账户凭据和银行卡支付处理相互独立。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">问题隐私与深度解读</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">免费起卦的问题输入是可选的，并受长度限制；会话回放中会被遮蔽，也不会写入网址、页面元数据、结构化数据、分析事件或应用日志。免费解读绝不向 AI 提供方发送问题或卦象。如果付费深度解读已开放，且你使用可用次数主动请求，起卦时锁定的核心问题和补充背景会加密保存为不可变快照；快照、本次卦象事实和有依据的易经材料会通过 Vercel AI Gateway 发送给已配置的模型和复核提供方。提供方可能依据各自适用的控制和隐私条款处理或保留请求。请勿输入不必要的敏感个人、健康、法律或财务信息。付费深度解读未开放时，不会发生上述处理。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">删除与保留记录</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">已登录用户可以在“我的账户”申请永久删除账户。删除事务会取消正在进行的生成、释放已冻结的解读次数、删除已保存的加密问题文本和生成内容、移除登录会话及已连接的登录账户，并匿名化个人资料。因会计、反欺诈、争议处理或法律义务所需，支付、权益、安全和审计记录可能继续保留；在数据模型允许时，保留记录会与已删除的个人资料分离。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">支持消息</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">如果你向 support@quickiching.com 发送邮件，消息中的信息会在回复请求以及维护适当的支持、安全和法律记录所需范围内处理。请不要发送不必要的敏感信息。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">你的控制方式</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">使用工具中的“重新起卦”可清除当前浏览器会话状态。你也可以在浏览器中清除站点数据；已登录用户可以从“我的账户”删除账户。隐私问题或权利请求可发送至 support@quickiching.com。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">儿童与政策变更</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching 并非面向儿童的服务。当产品、服务提供方或法律要求变化时，我们可能更新本政策；发生实质性文本变化时会更新上方日期。</p>

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-7 text-[var(--ink-2)]">另请参阅<Link href="/zh/terms" className="mx-1 font-semibold text-[var(--jade)] hover:underline">服务条款</Link>和<Link href="/zh/acceptable-use" className="mx-1 font-semibold text-[var(--jade)] hover:underline">使用规范</Link>。</p>
    </article>
  );
}
