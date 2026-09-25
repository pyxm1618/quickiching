"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";
import { ZH_HANS_READING_CONTENT } from "@/content/mei-hua-yi-shu/zh-Hans";
import { deleteHistoryRecord, publicReadingFromHistory, readHistoryRecords, renameHistoryRecord, type PublicHistoryRecord } from "@/domain/public-reading/history";

export function HistoryClient({
  showCloudBanner = false,
  locale = "en",
  initialRecords,
  initialEditingId = null,
  initialConfirmDeleteId = null,
  initialStorageError = null,
}: {
  showCloudBanner?: boolean;
  locale?: ContentLocale;
  initialRecords?: PublicHistoryRecord[];
  initialEditingId?: string | null;
  initialConfirmDeleteId?: string | null;
  initialStorageError?: string | null;
}) {
  const dictionary = getDictionary(locale);
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [records, setRecords] = useState<PublicHistoryRecord[]>(() => initialRecords ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialRecords?.[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(initialConfirmDeleteId);
  const [titleDraft, setTitleDraft] = useState(() => {
    if (initialEditingId && initialRecords) {
      const rec = initialRecords.find((r) => r.id === initialEditingId);
      return rec ? rec.title : "";
    }
    return "";
  });
  const [storageError, setStorageError] = useState<string | null>(initialStorageError);

  useEffect(() => {
    if (initialRecords !== undefined || initialStorageError !== null) return;
    try {
      const restored = readHistoryRecords();
      setRecords(restored);
      setSelectedId(restored[0]?.id ?? null);
    } catch (error: unknown) {
      setStorageError(error instanceof Error ? error.message : "HISTORY_STORAGE_UNAVAILABLE");
    }
  }, [initialRecords, initialStorageError]);

  const selectedRecord = useMemo(() => records.find((record) => record.id === selectedId) ?? null, [records, selectedId]);
  const selectedReading = useMemo(() => {
    if (!selectedRecord) return null;
    try {
      return publicReadingFromHistory(selectedRecord);
    } catch {
      return null;
    }
  }, [selectedRecord]);

  function beginRename(record: PublicHistoryRecord) {
    setEditingId(record.id);
    setTitleDraft(record.title);
  }

  function saveRename(id: string) {
    try {
      setRecords(renameHistoryRecord(id, titleDraft));
      setEditingId(null);
      setTitleDraft("");
    } catch (error: unknown) {
      setStorageError(error instanceof Error ? error.message : "HISTORY_RENAME_FAILED");
    }
  }

  function remove(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      const next = deleteHistoryRecord(id);
      setRecords(next);
      setSelectedId((current) => current === id ? (next[0]?.id ?? null) : current);
      if (editingId === id) setEditingId(null);
      setConfirmDeleteId(null);
    } catch (error: unknown) {
      setStorageError(error instanceof Error ? error.message : "HISTORY_DELETE_FAILED");
    }
  }

  if (storageError) {
    return <div className="mystic-card p-6" role="alert"><p className="mystic-kicker">{t("Local history unavailable", "本地记录不可用")}</p><h2 className="mt-2 font-display text-2xl font-normal">{t("This browser does not allow local storage", "当前浏览器不允许本地存储")}</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{t("Your readings are not uploaded or moved elsewhere. Enable browser storage if you want Save, View, Rename, and Delete here. Existing casting remains available without History.", "你的起卦记录不会因此上传或转移到其他位置。如需在这里保存、查看、重命名和删除记录，请允许浏览器本地存储；即使本地记录不可用，起卦功能仍可继续使用。")}</p></div>;
  }

  return (
    <div data-history-page>
      <div className="mystic-card-soft mb-5 p-5 text-sm leading-7 text-[var(--ink-2)] sm:p-6"><strong className="text-[var(--gold-2)]">{t("Browser-only history.", "仅保存在浏览器。")}</strong> {t("Saved readings stay in this browser’s localStorage. There is no account, database, cloud sync, shareable reading URL, or sitemap entry. Clearing site data can remove them.", "已保存的起卦记录只保存在当前浏览器的本地存储中，不属于账户数据库、云同步、可分享链接或站点地图内容。清除站点数据可能删除这些记录。")}</div>
      {showCloudBanner && (
        <div className="mb-7 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(235,178,85,0.06)] p-5 text-sm leading-7 text-[var(--ink-2)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <strong className="text-[var(--gold-2)] text-base">{t("Looking for your cloud readings, purchases, or AI reports?", "在找账户中的云端起卦、购买记录或深度解读？")}</strong>
              <p className="mt-1 text-xs text-[var(--ink-3)]">{t("Readings and reports saved with your account are securely stored in the cloud.", "通过账户保存的起卦和解读报告会保存在云端账户记录中。")}</p>
            </div>
            <Link href={zh ? "/zh/account" : "/account"} prefetch={false} className="mystic-button !py-2.5 !px-5 text-xs shrink-0 font-medium">
              {t("Open My Account →", "打开我的账户 →")}
            </Link>
          </div>
        </div>
      )}
      {records.length === 0 ? (
        <div className="mystic-card p-7 text-center"><p className="mystic-kicker">{t("No saved readings", "暂无已保存记录")}</p><h2 className="mt-2 font-display text-3xl font-normal">{t("Your local reflection shelf is empty", "当前浏览器还没有本地起卦记录")}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">{t("Use Save reading on any completed cast. The browser stores up to 50 records and rebuilds each result from its six-line facts.", "在任一完成的起卦结果中选择“保存本次解读”即可加入记录。浏览器最多保存 50 条，并根据每条记录的六爻事实重新构建结果。")}</p></div>
      ) : (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,.78fr),minmax(0,1.22fr)] lg:items-start">
          <section className="mystic-card p-5 sm:p-6" aria-labelledby="history-list-title">
            <div className="flex items-center justify-between gap-3"><div><p className="mystic-kicker">{t("Saved locally", "本地已保存")}</p><h2 id="history-list-title" className="mt-2 font-display text-2xl font-normal">{t("History", "起卦记录")} · {records.length}/50</h2></div></div>
            <ol className="mt-5 space-y-3">
              {records.map((record) => (
                <li key={record.id} className={`rounded-2xl border p-4 ${record.id === selectedId ? "border-[rgba(232,198,122,.42)] bg-[rgba(232,198,122,.07)]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                  {editingId === record.id ? (
                    <div className="flex flex-col gap-2"><label htmlFor={`history-title-${record.id}`} className="text-xs text-[var(--ink-3)]">{t("Rename reading", "重命名记录")}</label><input id={`history-title-${record.id}`} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} className="min-h-11 rounded-xl border border-white/[0.12] bg-[#100d18] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold)]" /><div className="flex gap-2"><button type="button" onClick={() => saveRename(record.id)} className="mystic-button">{t("Save name", "保存名称")}</button><button type="button" onClick={() => setEditingId(null)} className="mystic-button-secondary">{t("Cancel", "取消")}</button></div></div>
                  ) : (
                    <>
                      <button type="button" onClick={() => setSelectedId(record.id)} className="block w-full text-left" data-history-view={record.id}><span className="block font-semibold text-[var(--ink)]">{record.title}</span><span className="mt-1 block text-xs leading-5 text-[var(--ink-3)]">{zh ? record.method.replace("three-coin", "三枚铜钱").replace("yarrow", "蓍草").replace("mei-hua", "梅花易数").replace("manual", "手动起卦") : record.method} · {new Date(record.updatedAt).toLocaleString(zh ? "zh-CN" : undefined)}</span>{record.question ? <span className="mt-2 block truncate text-xs text-[var(--ink-2)]" data-clarity-mask="true" data-private-question="true">{record.question}</span> : null}</button>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs"><button type="button" onClick={() => beginRename(record)} className="font-semibold text-[var(--cyan)] hover:underline">{t("Rename", "重命名")}</button>{confirmDeleteId === record.id ? <><button type="button" onClick={() => remove(record.id)} className="font-semibold text-[var(--danger)] hover:underline" data-history-confirm-delete>{t("Confirm delete", "确认删除")}</button><button type="button" onClick={() => setConfirmDeleteId(null)} className="font-semibold text-[var(--ink-2)] hover:underline">{t("Cancel", "取消")}</button></> : <button type="button" onClick={() => remove(record.id)} className="font-semibold text-[var(--danger)] hover:underline">{t("Delete", "删除")}</button>}</div>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="history-view-title">
            <h2 id="history-view-title" className="sr-only">{t("Selected saved reading", "当前选中的起卦记录")}</h2>
            {selectedReading ? <PublicReadingResult reading={selectedReading} onNewReading={() => setSelectedId(null)} dictionary={dictionary} localizedContent={zh ? ZH_HANS_READING_CONTENT : undefined} /> : <div className="mystic-card p-7 text-center text-sm text-[var(--ink-2)]">{t("Select a saved reading to view it.", "请选择一条已保存的起卦记录查看。")}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
