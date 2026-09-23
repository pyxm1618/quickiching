import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicHistoryRecord } from "@/domain/public-reading/history";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HistoryClient } from "./history-client";

const mockRecord: PublicHistoryRecord = {
  schemaVersion: 1,
  id: "rec_1",
  title: "事业发展卦",
  question: "近期换工作是否合适？",
  createdAt: "2026-09-23T12:00:00.000Z",
  updatedAt: "2026-09-23T12:00:00.000Z",
  method: "three-coin",
  methodVersion: "three-coin-v1",
  lineValuesBottomUp: [7, 7, 7, 9, 7, 7],
  primaryHexagram: 1,
  changingLines: [4],
  relatingHexagram: 9,
};

describe("HistoryClient Component Render", () => {
  it("renders Chinese empty state cleanly", () => {
    const html = renderToStaticMarkup(<HistoryClient locale="zh-Hans" />);
    expect(html).toContain("仅保存在浏览器。");
    expect(html).toContain("暂无已保存记录");
    expect(html).toContain("当前浏览器还没有本地起卦记录");
    expect(html).toContain("在任一完成的起卦结果中选择“保存本次解读”即可加入记录");
    // Ensure English empty state kickers do not leak
    expect(html).not.toContain("No saved readings");
    expect(html).not.toContain("Your local reflection shelf is empty");
  });

  it("renders cloud banner pointing to /zh/account in Chinese mode", () => {
    const html = renderToStaticMarkup(
      <HistoryClient locale="zh-Hans" showCloudBanner={true} />,
    );
    expect(html).toContain("在找账户中的云端起卦、购买记录或深度解读？");
    expect(html).toContain("打开我的账户 →");
    expect(html).toContain('href="/zh/account"');
    expect(html).not.toContain('href="/account"');
  });

  it("renders cloud banner pointing to /account in English mode", () => {
    const html = renderToStaticMarkup(
      <HistoryClient locale="en" showCloudBanner={true} />,
    );
    expect(html).toContain("Looking for your cloud readings, purchases, or AI reports?");
    expect(html).toContain("Open My Account →");
    expect(html).toContain('href="/account"');
  });

  it("renders localized record list and methods in Chinese mode", () => {
    const html = renderToStaticMarkup(
      <HistoryClient locale="zh-Hans" initialRecords={[mockRecord]} />,
    );
    expect(html).toContain("本地已保存");
    expect(html).toContain("起卦记录 · 1/50");
    expect(html).toContain("事业发展卦");
    expect(html).toContain("近期换工作是否合适？");
    expect(html).toContain("三枚铜钱");
    expect(html).toContain("重命名");
    expect(html).toContain("删除");
  });

  it("renders rename state with clean Chinese buttons", () => {
    const html = renderToStaticMarkup(
      <HistoryClient
        locale="zh-Hans"
        initialRecords={[mockRecord]}
        initialEditingId="rec_1"
      />,
    );
    expect(html).toContain("重命名记录");
    expect(html).toContain("保存名称");
    expect(html).toContain("取消");
    expect(html).not.toContain("Save name");
    expect(html).not.toContain("Rename reading");
  });

  it("renders delete confirmation with clean Chinese buttons", () => {
    const html = renderToStaticMarkup(
      <HistoryClient
        locale="zh-Hans"
        initialRecords={[mockRecord]}
        initialConfirmDeleteId="rec_1"
      />,
    );
    expect(html).toContain("确认删除");
    expect(html).toContain("取消");
    // Ensure the second Cancel button was localized
    expect(html).not.toContain(">Cancel<");
    expect(html).not.toContain("Confirm delete");
  });

  it("renders localized storage error state", () => {
    const html = renderToStaticMarkup(
      <HistoryClient
        locale="zh-Hans"
        initialStorageError="HISTORY_STORAGE_UNAVAILABLE"
      />,
    );
    expect(html).toContain("本地记录不可用");
    expect(html).toContain("当前浏览器不允许本地存储");
    expect(html).toContain("你的起卦记录不会因此上传或转移到其他位置");
    expect(html).not.toContain("Local history unavailable");
  });
});
