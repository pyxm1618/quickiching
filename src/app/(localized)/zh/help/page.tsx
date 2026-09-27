import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "帮助与支持 | Quick I Ching",
  description: "Quick I Ching 四种起卦方法、浏览器记录、梅花易数时区、深度解读次数与退款的中文帮助。",
  robots: { index: false, follow: true },
};

export default function ChineseHelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">帮助支持</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">帮助与支持</h1>

      <h2 className="mt-10 font-display text-2xl font-medium">四种起卦都免费吗？</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">是。三枚铜钱、蓍草、梅花易数当前时间起卦和手动起卦，都可以得到本卦、动爻、存在时的之卦以及通用基础解读，不要求登录或付款。</p>
      <h2 className="mt-10 font-display text-2xl font-medium">我的起卦记录保存在哪里？</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">当前起卦或尚未完成的步骤使用浏览器会话存储（<code>sessionStorage</code>）。当你明确选择“保存本次解读”时，历史页最多在当前浏览器的本地存储（<code>localStorage</code>）中保存 50 条记录；这不是云端账户历史。清除站点或会话数据会移除相应本地记录。</p>
      <h2 className="mt-10 font-display text-2xl font-medium">为什么梅花易数需要时区？</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">当前时间约定需要确定当地民用日期和时辰。IANA 时区让浏览器知道固定起卦时刻对应的当地日期、小时与夏令时偏移。</p>
      <h2 className="mt-10 font-display text-2xl font-medium">能否获得针对我具体处境的解读？</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">免费的完整解读说明卦象本身，绝不调用 AI。定价页显示可购买时，登录用户可以申请三枚铜钱起卦的深度解读：结合第一掷前锁定的问题、你补充的现实背景、本次确切卦象与实际动爻、存在时的变卦（之卦），以及 Quick I Ching 提供的易经材料。背景不足或请求触及医疗、法律、投资、紧急安全等高风险边界时，不会开始生成。成功交付的报告保存在账户历史中。如果起卦前跳过了问题，本次只能查看免费结果；需要带着问题重新起卦。</p>
      <h2 className="mt-10 font-display text-2xl font-medium">次数包与退款怎么处理？</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">购买需要登录；价格、有效期和适用退款条款会在付款前展示。符合条件的深度解读开始时会预留一次，成功交付后才正式扣除；预留后的生成或复核失败会释放次数。生成开始前被风险规则阻断的请求不会创建付费解读任务。</p>
      <h2 className="mt-10 font-display text-2xl font-medium">还需要帮助？</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">请发送邮件至 support@quickiching.com。起卦概念可以继续查看<Link href="/zh/guides/changing-lines" className="mx-1 font-semibold text-[var(--jade)] hover:underline">动爻说明</Link>和<Link href="/zh/guides/primary-relating-hexagrams" className="mx-1 font-semibold text-[var(--jade)] hover:underline">本卦与之卦</Link>。</p>
    </article>
  );
}
