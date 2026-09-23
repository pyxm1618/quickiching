import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "服务条款 | Quick I Ching",
  description: "Quick I Ching 起卦方法、账户、深度解读次数与可选个性化解读服务的使用条款。",
  robots: { index: false, follow: true },
};

export default function ChineseTermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">法律条款</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">服务条款</h1>
      <p className="mt-4 text-sm text-[var(--ink-3)]">最后更新：2026 年 9 月 13 日</p>

      <h2 className="mt-10 font-display text-2xl font-medium">服务提供什么</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching 提供四种可在浏览器中使用的易经起卦方法：三枚铜钱、蓍草、一套公开说明的梅花易数当前时间约定，以及手动起卦；同时提供免费的通用解读与本地历史。注册用户在相关商业功能开放时，可以选择购买一次性的深度解读次数包（1、3 或 5 次，并非自动续费订阅），支付由 Waffo 处理，并可申请个性化智能深度解读。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">解读次数、智能生成与退款</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">深度解读次数自购买起有效 12 个月。启动一次付费深度解读时会临时冻结一个次数，只有成功交付解读后才会正式扣除；如果生成失败或被阻断，冻结次数会安全释放。你可以在购买后 7 天内通过“我的账户”或联系 support@quickiching.com 提交退款申请，并按既定退款标准审核。已记录的技术交付失败、结构缺失、卦象引用错误，或未结合你提交的问题背景，属于有效的退款理由；仅因主观上不认同解读或感觉“不准”，不会自动获得退款。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">用于反思，而非确定性预测或专业建议</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">本站用于文化探索和个人反思。起卦结果不能确立事实、保证未来、诊断疾病、确定法律权利，也不提供医疗、法律、财务、投资、税务、紧急事件或安全建议。你仍需对自己的决定负责，并在适当情况下依赖合格专业人士与现实证据。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">起卦完整性与重复起卦</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">已经生成的铜钱爻和已经完成的蓍草变化不能在同一次起卦中手工编辑。你可以清除整个浏览器会话后重新开始，但不建议仅为了得到偏好的答案而反复起卦，因为这会削弱工具的反思用途。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">方法与解读边界</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">易经与梅花易数在历史传承和解释方式上存在差异。Quick I Ching 会公开说明本站实际采用的计算约定，不宣称某一个网页实现就是唯一正统做法。免费的解读文本是通用说明，并不会自动针对用户的私人处境做个性化判断。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">使用规范</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">不得违法使用服务、试图破坏其安全性或可用性、把起卦结果包装成有保证的专业建议，也不得借此制造焦虑、依赖、骚扰，或对他人作出会产生重大后果的未经证实断言。更多边界见<Link href="/zh/acceptable-use" className="mx-1 font-semibold text-[var(--jade)] hover:underline">使用规范</Link>。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">知识产权</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching 不主张拥有历史上的易经传统或已进入公有领域的经典材料。本站原创软件、界面、品牌以及原创说明和解读文本，在适用法律允许的范围内仍受保护。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">可用性与变更</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">服务可能发生变化、进入维护或暂时不可用。我们不保证服务永不中断，也不保证任何特定的解读结果。</p>

      <h2 className="mt-10 font-display text-2xl font-medium">联系与法定权利</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">问题可发送至 support@quickiching.com。本条款无意排除依法不能被排除的强制性消费者权利。</p>

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-7 text-[var(--ink-2)]">数据处理详情见<Link href="/zh/privacy" className="mx-1 font-semibold text-[var(--jade)] hover:underline">隐私政策</Link>。</p>
    </article>
  );
}
