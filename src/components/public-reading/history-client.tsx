"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicReadingResult } from "@/components/public-reading/public-reading-result";
import { deleteHistoryRecord, publicReadingFromHistory, readHistoryRecords, renameHistoryRecord, type PublicHistoryRecord } from "@/domain/public-reading/history";

export function HistoryClient() {
  const [records, setRecords] = useState<PublicHistoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const restored = readHistoryRecords();
      setRecords(restored);
      setSelectedId(restored[0]?.id ?? null);
    } catch (error: unknown) {
      setStorageError(error instanceof Error ? error.message : "HISTORY_STORAGE_UNAVAILABLE");
    }
  }, []);

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
    return <div className="mystic-card p-6" role="alert"><p className="mystic-kicker">Local history unavailable</p><h2 className="mt-2 font-display text-2xl font-normal">This browser does not allow local storage</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">Your readings are not uploaded or moved elsewhere. Enable browser storage if you want Save, View, Rename, and Delete here. Existing casting remains available without History.</p></div>;
  }

  return (
    <div data-history-page>
      <div className="mystic-card-soft mb-7 p-5 text-sm leading-7 text-[var(--ink-2)] sm:p-6"><strong className="text-[var(--gold-2)]">Browser-only history.</strong> Saved readings stay in this browser’s localStorage. There is no account, database, cloud sync, shareable reading URL, or sitemap entry. Clearing site data can remove them.</div>
      {records.length === 0 ? (
        <div className="mystic-card p-7 text-center"><p className="mystic-kicker">No saved readings</p><h2 className="mt-2 font-display text-3xl font-normal">Your local reflection shelf is empty</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--ink-2)]">Use Save reading on any completed cast. The browser stores up to 50 records and rebuilds each result from its six-line facts.</p></div>
      ) : (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,.78fr),minmax(0,1.22fr)] lg:items-start">
          <section className="mystic-card p-5 sm:p-6" aria-labelledby="history-list-title">
            <div className="flex items-center justify-between gap-3"><div><p className="mystic-kicker">Saved locally</p><h2 id="history-list-title" className="mt-2 font-display text-2xl font-normal">History · {records.length}/50</h2></div></div>
            <ol className="mt-5 space-y-3">
              {records.map((record) => (
                <li key={record.id} className={`rounded-2xl border p-4 ${record.id === selectedId ? "border-[rgba(232,198,122,.42)] bg-[rgba(232,198,122,.07)]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                  {editingId === record.id ? (
                    <div className="flex flex-col gap-2"><label htmlFor={`history-title-${record.id}`} className="text-xs text-[var(--ink-3)]">Rename reading</label><input id={`history-title-${record.id}`} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} className="min-h-11 rounded-xl border border-white/[0.12] bg-[#100d18] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold)]" /><div className="flex gap-2"><button type="button" onClick={() => saveRename(record.id)} className="mystic-button">Save name</button><button type="button" onClick={() => setEditingId(null)} className="mystic-button-secondary">Cancel</button></div></div>
                  ) : (
                    <>
                      <button type="button" onClick={() => setSelectedId(record.id)} className="block w-full text-left" data-history-view={record.id}><span className="block font-semibold text-[var(--ink)]">{record.title}</span><span className="mt-1 block text-xs leading-5 text-[var(--ink-3)]">{record.method} · {new Date(record.updatedAt).toLocaleString()}</span>{record.question ? <span className="mt-2 block truncate text-xs text-[var(--ink-2)]" data-clarity-mask="true" data-private-question="true">{record.question}</span> : null}</button>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs"><button type="button" onClick={() => beginRename(record)} className="font-semibold text-[var(--cyan)] hover:underline">Rename</button>{confirmDeleteId === record.id ? <><button type="button" onClick={() => remove(record.id)} className="font-semibold text-[var(--danger)] hover:underline" data-history-confirm-delete>Confirm delete</button><button type="button" onClick={() => setConfirmDeleteId(null)} className="font-semibold text-[var(--ink-2)] hover:underline">Cancel</button></> : <button type="button" onClick={() => remove(record.id)} className="font-semibold text-[var(--danger)] hover:underline">Delete</button>}</div>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="history-view-title">
            <h2 id="history-view-title" className="sr-only">Selected saved reading</h2>
            {selectedReading ? <PublicReadingResult reading={selectedReading} onNewReading={() => setSelectedId(null)} /> : <div className="mystic-card p-7 text-center text-sm text-[var(--ink-2)]">Select a saved reading to view it.</div>}
          </section>
        </div>
      )}
    </div>
  );
}
