import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Component-level regression: every shell-owned navigation control must derive
 * its target from the ONE shared reactive location context. The mock below is
 * the location store; changing it stands for a same-path query/hash change and
 * for a back/forward transition.
 */
const state = vi.hoisted(() => ({
  location: { pathname: "/", search: "", hash: "" },
}));

vi.mock("@/navigation/navigation-location", () => ({
  useNavigationLocation: () => state.location,
  NavigationLocationProvider: ({ children }: { children: React.ReactNode }) => children,
  publishNavigationLocation: vi.fn(),
  subscribeNavigationLocation: vi.fn(() => () => {}),
  getNavigationLocationSnapshot: () => state.location,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.location.pathname,
  useSearchParams: () => new URLSearchParams(state.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ priority: _priority, unoptimized: _unoptimized, ...props }: any) => React.createElement("img", props),
}));

vi.mock("@/components/brand-mark", () => ({
  BrandMark: () => <span data-brand-mark="true" />,
}));

import { SceneNavigation } from "@/components/scene-navigation";
import { UserNavControl } from "@/components/auth/user-nav-control";
import { InfoPageHeader } from "@/components/info-pages/info-page-header";

describe("shell controls react to shared location context", () => {
  beforeEach(() => {
    state.location = { pathname: "/readings/result", search: "?session=A", hash: "#line-2" };
  });

  it("refreshes the SceneNavigation locale target on a same-path query change", () => {
    const before = renderToStaticMarkup(<SceneNavigation locale="en" />);
    expect(before).toContain("/zh/readings/result?session=A");

    state.location = { ...state.location, search: "?session=B" };
    const after = renderToStaticMarkup(<SceneNavigation locale="en" />);
    expect(after).toContain("/zh/readings/result?session=B");
    expect(after).not.toContain("session=A");
  });

  it("refreshes the InfoPageHeader locale target on a same-path hash change", () => {
    state.location = { pathname: "/guides/changing-lines", search: "", hash: "#section-a" };
    const before = renderToStaticMarkup(<InfoPageHeader locale="en" />);
    expect(before).toContain("#section-a");

    state.location = { ...state.location, hash: "#section-b" };
    const after = renderToStaticMarkup(<InfoPageHeader locale="en" />);
    expect(after).toContain("#section-b");
    expect(after).not.toContain("#section-a");
  });

  it("refreshes the auth callback target on a same-path query change", () => {
    const before = renderToStaticMarkup(<UserNavControl initialUser={null} />);
    expect(before).toContain("session%3DA");

    state.location = { ...state.location, search: "?session=B" };
    const after = renderToStaticMarkup(<UserNavControl initialUser={null} />);
    expect(after).toContain("session%3DB");
    expect(after).not.toContain("session%3DA");
  });

  it("refreshes both targets through a back/forward transition", () => {
    const sequence = ["?session=A", "?session=B", "?session=A"];
    for (const [index, search] of sequence.entries()) {
      state.location = { pathname: "/readings/result", search, hash: "" };
      const navigation = renderToStaticMarkup(<SceneNavigation locale="en" />);
      const account = renderToStaticMarkup(<UserNavControl initialUser={null} />);
      expect(navigation).toContain(`/zh/readings/result${search}`);
      expect(account).toContain(`session%3D${index === 1 ? "B" : "A"}`);
    }
  });

  it("keeps the locale target on the equivalent transactional surface, not Home", () => {
    const html = renderToStaticMarkup(<SceneNavigation locale="en" />);
    expect(html).toContain('href="/zh/readings/result?session=A"');
    expect(html).not.toContain('href="/zh"');
  });
});
