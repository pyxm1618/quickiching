import React from "react";
export function AccountHeading({ title, subtitle, id }: { title: string; subtitle: string; id?: string }) {
  return <header className="qic-account-heading">
    <h1 id={id}><span className="qic-account-seal" aria-hidden="true">I Ching</span><span>{title}</span></h1>
    <p id={id ? "qic-account-subtitle" : undefined}>{subtitle}</p>
  </header>;
}
