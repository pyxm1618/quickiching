import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/account",
}));

import { UserNavControl } from "./user-nav-control";

describe("UserNavControl Component Render", () => {
  it("renders Sign in and Sign up when unauthenticated", () => {
    const html = renderToStaticMarkup(<UserNavControl initialUser={null} />);
    expect(html).toContain("Sign in");
    expect(html).toContain("Sign up");
    expect(html).toContain('href="/signin?callbackURL=%2Faccount"');
    expect(html).toContain('href="/signup?callbackURL=%2Faccount"');
  });

  it("renders user initial and email prefix when authenticated", () => {
    const html = renderToStaticMarkup(
      <UserNavControl initialUser={{ id: "usr_1", email: "pyxm1618@gmail.com" }} />,
    );
    expect(html).toContain("P");
    expect(html).toContain("pyxm1618");
    expect(html).toContain('aria-label="User menu for pyxm1618@gmail.com"');
  });

  it("implements Escape and arrow-key behavior for account menu semantics", () => {
    const source = readFileSync(new URL("./user-nav-control.tsx", import.meta.url), "utf8");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain("menuTriggerRef.current?.focus()");
  });

  it("renders Chinese account menu with /zh/my-readings when open", () => {
    const html = renderToStaticMarkup(
      <UserNavControl
        initialUser={{ id: "usr_zh", email: "test@example.com" }}
        locale="zh-Hans"
        initialOpen={true}
      />,
    );
    expect(html).toContain('href="/zh/my-readings"');
    expect(html).toContain("我的账户");
    expect(html).toContain("我的解读");
    expect(html).toContain("设置");
    expect(html.match(/role="menuitem"/g)).toHaveLength(3);
    expect(html).not.toContain("退出登录");
    expect(html).not.toMatch(/href="\/account"/);
  });

  it("renders Chinese unauthenticated links to /zh/signin and /zh/signup", () => {
    const html = renderToStaticMarkup(
      <UserNavControl initialUser={null} locale="zh-Hans" />,
    );
    expect(html).toContain("登录");
    expect(html).toContain("注册");
    expect(html).toContain('href="/zh/signin?callbackURL=%2Faccount"');
    expect(html).toContain('href="/zh/signup?callbackURL=%2Faccount"');
  });
});
