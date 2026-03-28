import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { shortName } from "@/lib/utils";
import { downloadShareFile } from "@/lib/fileShareStorage";
import type { ProfileShort } from "@/lib/utils";
import ShareCreateModal from "@/components/fileshare/ShareCreateModal";
import ShareDetailModal from "@/components/fileshare/ShareDetailModal";
import ShareFilters from "@/components/fileshare/ShareFilters";
import type { ShareFilterKey } from "@/components/fileshare/ShareFilters";
import ShareMobileCards from "@/components/fileshare/ShareMobileCards";
import ShareDesktopTable from "@/components/fileshare/ShareDesktopTable";
import { useDictionaries } from "@/hooks/useDictionaries";

const FilePreviewModal = lazy(() => import("@/components/ui/FilePreviewModal"));

type Tab = "incoming" | "outgoing" | "drafts" | "all" | "trash";
type SortDir = "asc" | "desc";

interface ShareFile { id: string; file_name: string; file_size: number; storage_path: string }

interface ShareRow {
  id: string;
  comment: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  created_by: string;
  building_id: string | null;
  floor_id: string | null;
  work_type_id: string | null;
  construction_id: string | null;
  work_id: string | null;
  tag: string | null;
  manual_tag: string | null;
  creator: ProfileShort | null;
  file_share_files: ShareFile[];
  file_share_recipients: {
    user_id: string;
    is_read: boolean;
    trashed_at: string | null;
    recipient: ProfileShort | null;
  }[];
}

async function downloadFile(storagePath: string, fileName: string) {
  const data = await downloadShareFile(storagePath);
  if (data) {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default function FileSharePage() {
  const { project } = useProject();
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("incoming");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);

  // Справочники для фильтров
  const { buildings, floors, workTypes, constructions, works, loadDicts } = useDictionaries();
  useEffect(() => { loadDicts(); }, [loadDicts]);

  const emptyFilters: Record<ShareFilterKey, Set<string>> = { building: new Set(), workType: new Set(), floor: new Set(), construction: new Set(), work: new Set(), manualTag: new Set() };
  const [filters, setFilters] = useState(emptyFilters);
  const [openFilter, setOpenFilter] = useState<ShareFilterKey | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadShares = useCallback(async () => {
    if (!project || !user) return;
    const { data, error } = await supabase
      .from("file_shares")
      .select(`
        id, comment, status, created_at, sent_at, created_by,
        building_id, floor_id, work_type_id, construction_id, work_id, tag, manual_tag,
        creator:profiles!created_by(last_name, first_name, middle_name),
        file_share_files(id, file_name, file_size, storage_path),
        file_share_recipients(user_id, is_read, trashed_at, recipient:profiles!user_id(last_name, first_name, middle_name))
      `)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (error) { setLoadError("Не удалось загрузить файлы"); setLoading(false); return; }
    if (data) setShares(data as unknown as ShareRow[]);
    setLoadError("");
    setLoading(false);
  }, [project, user]);

  useEffect(() => { loadShares(); }, [loadShares]);

  const userId = user?.id;

  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
  function isExpired(s: ShareRow): boolean {
    return Date.now() - new Date(s.created_at).getTime() > FOURTEEN_DAYS;
  }

  // Фильтрация
  const incoming = shares.filter((s) =>
    s.status === "sent" && !isExpired(s) && s.created_by !== userId &&
    s.file_share_recipients.some((r) => r.user_id === userId && !r.trashed_at)
  );
  const outgoing = shares.filter((s) => s.status === "sent" && !isExpired(s) && s.created_by === userId);
  const drafts = shares.filter((s) => s.status === "draft" && !isExpired(s) && s.created_by === userId);
  const all = shares.filter((s) => {
    if (isExpired(s)) return false;
    if (s.status === "draft") return s.created_by === userId;
    if (s.status === "sent") {
      if (s.created_by === userId) return true;
      return s.file_share_recipients.some((r) => r.user_id === userId && !r.trashed_at);
    }
    return false;
  });
  const trash = shares.filter((s) =>
    s.status === "trashed" || isExpired(s) ||
    s.file_share_recipients.some((r) => r.user_id === userId && r.trashed_at)
  );

  const unreadCount = incoming.filter((s) =>
    s.file_share_recipients.some((r) => r.user_id === userId && !r.is_read)
  ).length;

  const tabShares: Record<Tab, ShareRow[]> = { incoming, outgoing, drafts, all, trash };
  const currentTab = tabShares[activeTab];

  // Маппинг id → name для фильтров
  const dictName = (list: { id: string; name: string }[], id: string | null) => list.find((d) => d.id === id)?.name || "";

  // Опции фильтров (уникальные значения из текущей вкладки)
  const filterOptions: Record<ShareFilterKey, string[]> = {
    building: [...new Set(currentTab.map((s) => dictName(buildings, s.building_id)).filter(Boolean))],
    workType: [...new Set(currentTab.map((s) => dictName(workTypes, s.work_type_id)).filter(Boolean))],
    floor: [...new Set(currentTab.map((s) => dictName(floors, s.floor_id)).filter(Boolean))],
    construction: [...new Set(currentTab.map((s) => dictName(constructions, s.construction_id)).filter(Boolean))],
    work: [...new Set(currentTab.map((s) => dictName(works, s.work_id)).filter(Boolean))],
    manualTag: [...new Set(currentTab.map((s) => s.manual_tag).filter(Boolean) as string[])],
  };

  function toggleFilterValue(key: ShareFilterKey, value: string) {
    setFilters((p) => {
      const s = new Set(p[key]);
      if (s.has(value)) s.delete(value); else s.add(value);
      return { ...p, [key]: s };
    });
  }

  const activeFilterCount = Object.values(filters).reduce((n, s) => n + s.size, 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (search ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  function clearFilters() {
    setFilters({ building: new Set(), workType: new Set(), floor: new Set(), construction: new Set(), work: new Set(), manualTag: new Set() });
    setDateFrom(""); setDateTo(""); setSearch("");
  }

  // Фильтрация
  const filtered = currentTab.filter((s) => {
    if (filters.building.size > 0 && !filters.building.has(dictName(buildings, s.building_id))) return false;
    if (filters.workType.size > 0 && !filters.workType.has(dictName(workTypes, s.work_type_id))) return false;
    if (filters.floor.size > 0 && !filters.floor.has(dictName(floors, s.floor_id))) return false;
    if (filters.construction.size > 0 && !filters.construction.has(dictName(constructions, s.construction_id))) return false;
    if (filters.work.size > 0 && !filters.work.has(dictName(works, s.work_id))) return false;
    if (filters.manualTag.size > 0 && (!s.manual_tag || !filters.manualTag.has(s.manual_tag))) return false;
    if (dateFrom) { const d = new Date(s.sent_at || s.created_at); if (d < new Date(dateFrom)) return false; }
    if (dateTo) { const d = new Date(s.sent_at || s.created_at); if (d > new Date(dateTo + "T23:59:59")) return false; }
    if (search) {
      const q = search.toLowerCase();
      const hay = [s.comment, s.tag, s.manual_tag, ...s.file_share_files.map((f) => f.file_name)].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Сортировка по дате
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.sent_at || a.created_at).getTime();
    const db = new Date(b.sent_at || b.created_at).getTime();
    return sortDir === "desc" ? db - da : da - db;
  });

  function isUnread(s: ShareRow): boolean {
    return s.file_share_recipients.some((r) => r.user_id === userId && !r.is_read);
  }

  async function markAsRead(shareId: string) {
    if (!user) return;
    await supabase.from("file_share_recipients").update({ is_read: true }).eq("share_id", shareId).eq("user_id", user.id);
    setShares((prev) => prev.map((s) =>
      s.id === shareId
        ? { ...s, file_share_recipients: s.file_share_recipients.map((r) => r.user_id === user.id ? { ...r, is_read: true } : r) }
        : s
    ));
  }

  function recipientNames(s: ShareRow): string {
    return s.file_share_recipients.map((r) => shortName(r.recipient)).filter(Boolean).join(", ") || "—";
  }

  function senderOrRecipient(s: ShareRow): string {
    if (s.created_by === userId) return recipientNames(s);
    return shortName(s.creator) || "—";
  }

  // Черновик → в корзину (status='trashed')
  async function handleTrashDraft(shareId: string) {
    await supabase.from("file_shares").update({ status: "trashed", trashed_at: new Date().toISOString() }).eq("id", shareId);
    loadShares();
  }

  // Входящая ячейка → в корзину для получателя
  async function handleTrashIncoming(shareId: string) {
    if (!user) return;
    await supabase.from("file_share_recipients").update({ trashed_at: new Date().toISOString() }).eq("share_id", shareId).eq("user_id", user.id);
    loadShares();
  }

  // Полное удаление ячеек из корзины (только своих)
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmTrashDrafts, setConfirmTrashDrafts] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleTrashAllDrafts() {
    setClearing(true);
    try {
      for (const s of drafts) {
        await supabase.from("file_shares").update({ status: "trashed", trashed_at: new Date().toISOString() }).eq("id", s.id);
      }
      setConfirmTrashDrafts(false);
      loadShares();
    } finally {
      setClearing(false);
    }
  }

  async function handleClearTrash() {
    if (!user) return;
    setClearing(true);
    try {
      // Удаляем свои ячейки со статусом trashed
      const myTrashed = trash.filter((s) => s.created_by === userId && s.status === "trashed");
      for (const s of myTrashed) {
        const { data: files } = await supabase.from("file_share_files").select("storage_path").eq("share_id", s.id);
        if (files && files.length > 0) {
          const { removeShareFiles } = await import("@/lib/fileShareStorage");
          await removeShareFiles(files.map((f) => f.storage_path));
        }
        await supabase.from("file_shares").delete().eq("id", s.id);
      }
      // Для чужих ячеек в корзине — уже trashed_at стоит, ничего удалять не нужно
      setConfirmClear(false);
      loadShares();
    } finally {
      setClearing(false);
    }
  }

  const tabs: { key: Tab; label: string; count?: number; showBadge?: boolean }[] = [
    { key: "incoming", label: "Входящие", count: unreadCount, showBadge: unreadCount > 0 },
    { key: "outgoing", label: "Исходящие" },
    { key: "drafts", label: "Черновики", count: drafts.length, showBadge: drafts.length > 0 },
    { key: "all", label: "Все" },
    { key: "trash", label: "Корзина" },
  ];

  const isIncoming = activeTab === "incoming";
  const senderLabel = isIncoming || activeTab === "all" || activeTab === "trash" ? "Отправитель" : "Получатель";

  return (
    <div>
      {/* Заголовок */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-4"}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
            Обмен файлами
          </h2>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="ds-icon-btn relative"
            style={showFilters || hasActiveFilters ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" } : undefined}
            title="Фильтры"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
        </div>
        <button
          onClick={() => { setEditDraftId(null); setShowCreate(true); }}
          className={`ds-btn font-medium flex items-center gap-2 ${isMobile ? "p-2" : "px-4 py-2 text-sm"}`}
          title="Поделиться"
        >
          <svg className={isMobile ? "w-5 h-5" : "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {!isMobile && "Поделиться"}
        </button>
      </div>

      {/* Вкладки */}
      <div className={`flex ${isMobile ? "mb-3 justify-around" : "mb-4"}`} style={{ borderBottom: "1px solid var(--ds-border)" }}>
        {tabs.map((tab) => {
          const icons: Record<Tab, React.ReactNode> = {
            incoming: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
            outgoing: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0l-4 4m4-4v12" /></svg>,
            drafts: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
            all: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
            trash: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
          };
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative ${isMobile ? "flex flex-col items-center gap-0.5 px-3 py-2" : "px-4 py-2.5 text-sm"} font-medium transition-colors border-b-2 whitespace-nowrap`}
              style={activeTab === tab.key
                ? { color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                : { color: "var(--ds-text-muted)", borderColor: "transparent" }}
              title={tab.label}
            >
              {isMobile ? (
                <>
                  {icons[tab.key]}
                  {tab.showBadge && tab.count != null && tab.count > 0 && (
                    <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1 bg-red-500 text-white">
                      {tab.count}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {tab.label}
                  {tab.showBadge && tab.count != null && tab.count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
                      {tab.count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Фильтры */}
      {showFilters && <ShareFilters
        filters={filters} setFilters={setFilters}
        filterOptions={filterOptions}
        openFilter={openFilter} setOpenFilter={setOpenFilter}
        filterRef={filterRef}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        search={search} setSearch={setSearch}
        showSearch={showSearch} setShowSearch={setShowSearch}
        hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount}
        filteredCount={filtered.length} totalCount={currentTab.length}
        clearFilters={clearFilters} toggleFilterValue={toggleFilterValue}
      />}

      {/* Кнопка «Все в корзину» для черновиков */}
      {activeTab === "drafts" && drafts.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setConfirmTrashDrafts(true)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 8%, var(--ds-surface))" }}
          >
            Все в корзину
          </button>
        </div>
      )}

      {/* Кнопка очистки корзины */}
      {activeTab === "trash" && trash.filter((s) => s.created_by === userId && s.status === "trashed").length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 8%, var(--ds-surface))" }}
          >
            Очистить корзину
          </button>
        </div>
      )}

      {/* Диалог подтверждения — черновики в корзину */}
      {confirmTrashDrafts && (
        <div className="ds-overlay" style={{ zIndex: 99999 }}>
          <div className="ds-overlay-bg" onClick={() => setConfirmTrashDrafts(false)} />
          <div className="ds-modal mx-4 max-w-sm p-6" style={{ zIndex: 100000 }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--ds-text)" }}>Отправить все черновики в корзину?</h3>
            <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
              {drafts.length} черновик(ов) будут перемещены в корзину.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmTrashDrafts(false)} className="ds-btn-secondary px-4 py-2 text-sm" disabled={clearing}>
                Отмена
              </button>
              <button onClick={handleTrashAllDrafts} className="ds-btn-danger px-4 py-2 text-sm" disabled={clearing}>
                {clearing ? "Перемещение..." : "В корзину"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог подтверждения — очистка корзины */}
      {confirmClear && (
        <div className="ds-overlay" style={{ zIndex: 99999 }}>
          <div className="ds-overlay-bg" onClick={() => setConfirmClear(false)} />
          <div className="ds-modal mx-4 max-w-sm p-6" style={{ zIndex: 100000 }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--ds-text)" }}>Очистить корзину?</h3>
            <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
              Все ваши ячейки из корзины будут удалены безвозвратно вместе с файлами.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmClear(false)} className="ds-btn-secondary px-4 py-2 text-sm" disabled={clearing}>
                Отмена
              </button>
              <button onClick={handleClearTrash} className="ds-btn-danger px-4 py-2 text-sm" disabled={clearing}>
                {clearing ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div className="ds-card p-6 text-center">
          <p className="text-sm mb-3" style={{ color: "#ef4444" }}>{loadError}</p>
          <button onClick={() => loadShares()} className="ds-btn text-sm">Повторить</button>
        </div>
      )}

      {/* Мобильные карточки / Таблица десктоп */}
      {isMobile ? (
        <ShareMobileCards
          shares={sorted}
          loading={loading}
          activeTab={activeTab}
          isIncoming={isIncoming}
          userId={userId}
          isUnread={isUnread}
          senderOrRecipient={senderOrRecipient}
          markAsRead={markAsRead}
          downloadFile={downloadFile}
          handleTrashDraft={handleTrashDraft}
          handleTrashIncoming={handleTrashIncoming}
          onOpenDraft={(id) => { setEditDraftId(id); setShowCreate(true); }}
          onOpenDetail={(id) => setDetailId(id)}
          onPreview={(fileName, storagePath) => setPreviewFile({ fileName, storagePath })}
        />
      ) : (
        <ShareDesktopTable
          shares={sorted}
          loading={loading}
          activeTab={activeTab}
          isIncoming={isIncoming}
          senderLabel={senderLabel}
          sortDir={sortDir}
          onToggleSort={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
          userId={userId}
          isUnread={isUnread}
          senderOrRecipient={senderOrRecipient}
          markAsRead={markAsRead}
          downloadFile={downloadFile}
          handleTrashDraft={handleTrashDraft}
          handleTrashIncoming={handleTrashIncoming}
          onOpenDraft={(id) => { setEditDraftId(id); setShowCreate(true); }}
          onOpenDetail={(id) => setDetailId(id)}
          onPreview={(fileName, storagePath) => setPreviewFile({ fileName, storagePath })}
        />
      )}

      {/* Модалки */}
      {showCreate && (
        <ShareCreateModal
          open={showCreate}
          onClose={() => { setShowCreate(false); setEditDraftId(null); }}
          onCreated={() => { setShowCreate(false); setEditDraftId(null); loadShares(); }}
          draftId={editDraftId || undefined}
        />
      )}

      {detailId && (
        <ShareDetailModal
          shareId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={loadShares}
        />
      )}

      <Suspense fallback={null}>
        {previewFile && (
          <FilePreviewModal
            fileName={previewFile.fileName}
            storagePath={previewFile.storagePath}
            bucket="fileshare-files"
            onClose={() => setPreviewFile(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
