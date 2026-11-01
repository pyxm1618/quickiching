import type { Metadata } from "next";
import { alternateLanguages } from "@/i18n/helpers";
import { LegalPageLayout } from "@/components/info-pages/legal-page-layout";

export const metadata: Metadata = {
  title: "使用规范 | Quick I Ching",
  description: "负责任使用 Quick I Ching 的边界与禁止事项。",
  alternates: { canonical: "/zh/acceptable-use", languages: alternateLanguages("acceptable-use") },
  robots: { index: false, follow: true },
};

export default function ChineseAcceptableUsePage() {
  return (
    <LegalPageLayout
      locale="zh-Hans"
      title="使用规范"
      lead="Quick I Ching 用于反思，不用于制造依赖，也不提供会产生重大后果的确定性结论。"
      sections={[]}
      intro={<>
        <ul>
          <li>不要把起卦结果当作医疗、法律、财务、投资、紧急事件或安全指令。</li>
          <li>不要把起卦结果当作证据，声称未来事件必然发生，或声称他人做过某件事、存在隐藏动机或患有某种健康问题。</li>
          <li>不要通过反复起卦制造焦虑、依赖或继续使用工具的压力。</li>
          <li>不要试图破坏或过载服务，不要以滥用规模抓取，也不要绕过技术或安全控制。</li>
          <li>不要提交或暴露他人不必要的私人或保密信息。</li>
          <li>不要把服务用于骚扰、胁迫、欺诈、歧视或其他违法活动。</li>
        </ul>
        <p>如果现实决定可能产生严重后果，请使用适当证据并寻求合格专业支持。易经起卦可以继续作为反思框架，但不能替代这些保障。</p>
      </>}
    />
  );
}
