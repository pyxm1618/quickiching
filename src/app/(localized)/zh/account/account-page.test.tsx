import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); } }));
import ChineseAccountPage from "./page";
import AccountPage from "@/app/(default)/account/page";
describe("legacy account route compatibility", () => {
  it("opens My Account on the existing English home page", () => {
    expect(() => AccountPage()).toThrow("NEXT_REDIRECT:/?account=open");
  });
  it("opens My Account on the existing Chinese home page", () => {
    expect(() => ChineseAccountPage()).toThrow("NEXT_REDIRECT:/zh?account=open");
  });
});
