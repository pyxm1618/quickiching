import type { Metadata } from "next";
import Link from "next/link";
import { alternateLanguages } from "@/i18n/helpers";
import { PrivacySettingsButton } from "@/components/privacy-settings-button";
import { LegalPageLayout, type LegalSection } from "@/components/info-pages/legal-page-layout";
import styles from "@/components/info-pages/info-pages.module.css";

export const metadata: Metadata = {
  title: "隐私政策 | Quick I Ching",
  description: "说明 Quick I Ching 如何处理浏览器数据、账户数据、分析与广告、技术日志和支持消息。",
  alternates: { canonical: "/zh/privacy", languages: alternateLanguages("privacy") },
  robots: { index: false, follow: true },
};

const SECTIONS: readonly LegalSection[] = [
  { title: "公开起卦数据", body: <p>起卦进度、可选问题与固定的方法事实可能保存在浏览器会话存储（<code>sessionStorage</code>）中，使当前起卦在页面刷新后仍可恢复。Quick I Ching 不维护独立的浏览器本地解读历史。登录后的三枚铜钱起卦完成正式账户保存后，对应的账户记录可以出现在“我的解读”中。</p> },
  { title: "账户与付费解读数据", body: <p>当商业账户功能已启用且你登录后，Quick I Ching 会保存提供这些功能所需的账户、起卦状态、权益和支付状态。支付由第三方支付合作方 Waffo 安全处理，Quick I Ching 不存储原始银行卡信息。如果问题与“我的解读”中的账户记录关联，问题文本会以带版本的加密密钥在服务器端加密保存。付费深度解读输出、订单记录与退款处理状态会保存在服务器端，用于交付解读、维护可用次数、处理符合条件的退款并防止重复扣费。</p> },
  { title: "托管与技术日志", body: <p>与多数网站一样，托管和网络服务商可能处理常规请求信息，例如 IP 地址、浏览器信息、请求网址、时间戳以及安全或可靠性日志。这些记录可用于提供站点服务、防止滥用、诊断故障和履行法律义务。</p> },
  { title: "分析与同意选择", body: <><p>Quick I Ching 仅在你明确选择“允许分析”后，才使用 Google Analytics 4 进行汇总流量分析，并使用 Microsoft Clarity 了解交互与会话体验。该选择保存在当前浏览器中。你可以随时通过页脚中的<strong>“隐私与网站数据设置”</strong>重新打开选择；如果拒绝或之后撤回分析同意，Quick I Ching 会停止分析服务、移除站内加载的分析脚本，并尝试清除常见的分析 Cookie。</p><p>这一站内分析选择与以后可能通过 Google 广告后台配置的广告同意消息相互独立。</p></> },
  { title: "Google 发布商与广告技术", body: <><p>Quick I Ching 已配置 Google 发布商标识、发布商授权记录以及用于所有权验证的发布商账户元数据。当前应用不会加载 Google 广告代码，也不会渲染商业广告单元。</p><p>如果以后启用 Google 广告，包括 Google 在内的第三方服务商可能因广告投放而设置或读取 Cookie、使用网络信标、处理 IP 地址或使用其他标识符。这些技术可用于投放和衡量广告、限制重复广告、统计效果、防止欺诈与滥用，并在用户选择和适用法律允许时用于个性化广告。</p><p>在法律要求广告同意的地区，Quick I Ching 会在启用个性化广告前，通过 Google 广告后台配置的认证同意管理平台取得相应选择。本隐私政策页面本身不会加载需要用户同意的广告标签或同意消息标签。关于 Google 如何处理合作伙伴网站上的数据，可查看<a href="https://policies.google.com/technologies/partner-sites" rel="noreferrer">Google 合作伙伴网站数据说明</a>；也可以查看 Google 的<a href="https://adssettings.google.com/" rel="noreferrer">广告设置</a>。</p></> },
  { title: "问题隐私与深度解读", body: <p>免费起卦的问题输入是可选的，并受长度限制；会话回放中会被遮蔽，也不会写入网址、页面元数据、结构化数据、分析事件或应用日志。免费解读绝不向 AI 提供方发送问题或卦象。深度解读需要登录账户、在第一掷前锁定一个清晰问题、补充足够背景、持有可用次数并通过高风险内容检查。符合条件后，锁定的问题和你提交的背景会加密保存在不可变的账户快照中。生成报告时，系统会解密这些字段，并将它们与本次确切卦象事实及 Quick I Ching 提供的易经材料发送给已配置的生成与复核服务。成功交付的报告会保存到账户历史。生成开始时预留一次，交付成功后才扣除；预留后的失败会释放次数。服务提供方可能依据各自适用的控制和隐私条款处理或保留请求。请勿输入不必要的敏感个人、健康、法律或财务信息。只有在深度解读已开放且你提交符合条件的请求时，才会发生上述付费处理。</p> },
  { title: "删除与保留记录", body: <p>已登录用户可以在“我的账户”申请永久删除账户。删除事务会取消正在进行的生成、释放已冻结的解读次数、删除已保存的加密问题文本和生成内容、移除登录会话及已连接的登录账户，并匿名化个人资料。因会计、反欺诈、争议处理或法律义务所需，支付、权益、安全和审计记录可能继续保留；在数据模型允许时，保留记录会与已删除的个人资料分离。</p> },
  { title: "支持消息", body: <p>如果你向 <a href="mailto:support@quickiching.com">support@quickiching.com</a> 发送邮件，消息中的信息会在回复请求以及维护适当的支持、安全和法律记录所需范围内处理。请不要发送不必要的敏感信息。</p> },
  { title: "你的控制方式", body: <><p>使用工具中的“重新起卦”可清除当前浏览器会话状态。使用页脚中的<strong>“隐私与网站数据设置”</strong>可查看或修改同意选择。你也可以在浏览器中清除站点数据；已登录用户可以从“我的账户”删除账户。隐私问题或权利请求可发送至 <a href="mailto:support@quickiching.com">support@quickiching.com</a>。</p><div className={styles.privacyButton}><PrivacySettingsButton locale="zh-Hans" /></div></> },
  { title: "儿童与政策变更", body: <p>Quick I Ching 并非面向儿童的服务。当产品、服务提供方或法律要求变化时，我们可能更新本政策；发生实质性文本变化时会更新上方日期。</p> },
];

export default function ChinesePrivacyPage() {
  return <LegalPageLayout locale="zh-Hans" title="隐私政策" lead={metadata.description as string} updated="最后更新：2026 年 10 月 27 日" sections={SECTIONS} footer={<p>另请参阅 <Link href="/zh/terms">服务条款</Link> 和 <Link href="/zh/acceptable-use">使用规范</Link>。</p>} />;
}
