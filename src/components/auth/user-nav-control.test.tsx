import React from "react";
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

  it("can hide unauthenticated controls in the compact mobile header without affecting the drawer", () => {
    const html = renderToStaticMarkup(
      <UserNavControl initialUser={null} hideUnauthenticated={true} />,
    );
    expect(html).toBe("");
  });

  it("renders user initial and email prefix when authenticated", () => {
    const html = renderToStaticMarkup(
      <UserNavControl initialUser={{ id: "usr_1", email: "pyxm1618@gmail.com" }} />,
    );
    expect(html).toContain("P"); // initial of pyxm1618
    expect(html).toContain("pyxm1618");
    expect(html).toContain('aria-label="User menu for pyxm1618@gmail.com"');
  });

  it("renders mobile drawer variant properly", () => {
    const html = renderToStaticMarkup(
      <UserNavControl
        initialUser={{ id: "usr_1", email: "pyxm1618@gmail.com" }}
        isMobileDrawer={true}
      />,
    );
    expect(html).toContain("pyxm1618@gmail.com");
    expect(html).toContain("Active Account");
    expect(html).toContain("My Account &amp; History");
    expect(html).toContain("Sign Out");
  });

  it("renders mobile drawer Sign in and Sign up when unauthenticated", () => {
    const html = renderToStaticMarkup(
      <UserNavControl initialUser={null} isMobileDrawer={true} />,
    );
    expect(html).toContain("Sign in");
    expect(html).toContain("Sign up");
    expect(html).toContain('href="/signin?callbackURL=%2Faccount"');
    expect(html).toContain('href="/signup?callbackURL=%2Faccount"');
  });

  it("renders Chinese desktop menu with /zh/account when open", () => {
    const html = renderToStaticMarkup(
      <UserNavControl
        initialUser={{ id: "usr_zh", email: "test@example.com" }}
        locale="zh-Hans"
        initialOpen={true}
      />,
    );
    expect(html).toContain('href="/zh/account"');
    expect(html).toContain('href="/zh/history"');
    expect(html).toContain("我的账户");
    expect(html).toContain("起卦记录");
    expect(html).toContain("退出登录");
    expect(html).not.toMatch(/href="\/account"/);
  });

  it("renders Chinese unauthenticated desktop links to /zh/signin and /zh/signup", () => {
    const html = renderToStaticMarkup(
      <UserNavControl initialUser={null} locale="zh-Hans" />,
    );
    expect(html).toContain("登录");
    expect(html).toContain("注册");
    expect(html).toContain('href="/zh/signin?callbackURL=%2Faccount"');
    expect(html).toContain('href="/zh/signup?callbackURL=%2Faccount"');
  });

  it("renders Chinese mobile drawer authenticated links with /zh/account", () => {
    const html = renderToStaticMarkup(
      <UserNavControl
        initialUser={{ id: "usr_zh", email: "test@example.com" }}
        locale="zh-Hans"
        isMobileDrawer={true}
      />,
    );
    expect(html).toContain("账户已登录");
    expect(html).toContain("账户与起卦记录");
    expect(html).toContain('href="/zh/account"');
    expect(html).toContain("退出登录");
  });
});
