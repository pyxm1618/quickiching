import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "使用规范 | Quick I Ching",
  description: "负责任使用 Quick I Ching 的边界与禁止事项。",
  robots: { index: false, follow: true },
};

export default function ChineseAcceptableUsePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">负责任使用</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">使用规范</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">Quick I Ching 用于反思，不用于制造依赖，也不提供会产生重大后果的确定性结论。</p>
      <ul className="mt-8 list-disc space-y-3 pl-6 text-sm leading-7 text-[var(--ink-2)]">
        <li>不要把起卦结果当作医疗、法律、财务、投资、紧急事件或安全指令。</li>
        <li>不要把起卦结果当作证据，声称未来事件必然发生，或声称他人做过某件事、存在隐藏动机或患有某种健康问题。</li>
        <li>不要通过反复起卦制造焦虑、依赖或继续使用工具的压力。</li>
        <li>不要试图破坏或过载服务，不要以滥用规模抓取，也不要绕过技术或安全控制。</li>
        <li>不要提交或暴露他人不必要的私人或保密信息。</li>
        <li>不要把服务用于骚扰、胁迫、欺诈、歧视或其他违法活动。</li>
      </ul>
      <p className="mt-8 text-sm leading-7 text-[var(--ink-2)]">如果现实决定可能产生严重后果，请使用适当证据并寻求合格专业支持。易经起卦可以继续作为反思框架，但不能替代这些保障。</p>
    </article>
  );
}
