import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { shortName, formatDateTime } from "@/lib/utils";
import type { ProfileShort } from "@/lib/utils";
import Pagination, { usePagination, getStoredPageSize } from "@/components/ui/Pagination";

interface HistoryRow {
  id: string;
  created_at: string;
  action: string;
  details: Record<string, any> | null;
  cell_id: string;
  user_id: string;
  cells: { name: string } | null;
  profiles: ProfileShort | null;
}

// Только действия по загрузке/скачиванию файлов
const FILE_ACTIONS = new Set([
  "file_uploaded",
  "file_version_added",
  "file_renamed",
  "scan_attached",
  "scan_deleted",
]);

const ACTION_LABELS: Record<string, string> = {
  file_uploaded: "Загрузка файла",
  file_version_added: "Новая версия файла",
  file_renamed: "Переименование файла",
  scan_attached: "Прикрепление скана",
  scan_deleted: "Удаление скана",
};


function detailsText(_action: string, details: Record<string, any> | null): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.from && details.to) parts.push(`${details.from} → ${details.to}`);
  else if (details.status) parts.push(details.status);
  if (details.comment) parts.push(details.comment);
  if (details.file_name) parts.push(details.file_name);
  return parts.join(" · ");
}

export default function ProjectHistoryTab() {
  const { project } = useProject();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);

  const [allLoaded, setAllLoaded] = useState(false);

  const loadHistory = useCallback(async (loadAll = false) => {
    if (!project) return;
    setLoading(true);

    // Загрузить cell_id всех ячеек проекта, затем историю
    const { data: cellIds } = await supabase
      .from("cells")
      .select("id")
      .eq("project_id", project.id);

    if (!cellIds || cellIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = cellIds.map((c) => c.id);
    let query = supabase
      .from("cell_history")
      .select(`
        id, created_at, action, details, cell_id, user_id,
        cells(name),
        profiles(last_name, first_name, middle_name)
      `)
      .in("cell_id", ids)
      .in("action", Array.from(FILE_ACTIONS))
      .order("created_at", { ascending: false });
    if (!loadAll) query = query.limit(200);
    const { data } = await query;

    if (data) setRows(data as unknown as HistoryRow[]);
    if (loadAll) setAllLoaded(true);
    setLoading(false);
  }, [project]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // При активации фильтров подгружаем все данные
  useEffect(() => {
    if ((search || actionFilter) && !allLoaded) loadHistory(true);
  }, [search, actionFilter, allLoaded, loadHistory]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.action);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const cellName = r.cells?.name?.toLowerCase() || "";
        const userName = shortName(r.profiles).toLowerCase();
        if (!cellName.includes(q) && !userName.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, actionFilter]);

  useEffect(() => { setPage(1); }, [search, actionFilter]);

  const paginatedRows = usePagination(filtered, page, pageSize);

  return (
    <div className="ds-card overflow-hidden">
      {/* Фильтры */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ячейке или пользователю..."
            className="ds-input pl-10"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="ds-input w-auto"
        >
          <option value="">Все действия</option>
          {actions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <div className="ml-auto text-xs" style={{ color: "var(--ds-text-faint)" }}>
          {filtered.length} из {rows.length} записей
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto">
        <table className="ds-table">
          <thead>
            <tr>
              <th className="w-36">Дата</th>
              <th>Пользователь</th>
              <th>Ячейка</th>
              <th>Действие</th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--ds-text-faint)" }}>Нет записей</td></tr>
            ) : (
              paginatedRows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatDateTime(r.created_at)}</td>
                  <td style={{ color: "var(--ds-text-muted)" }}>{shortName(r.profiles)}</td>
                  <td className="font-medium">{r.cells?.name || "—"}</td>
                  <td>
                    <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                      {ACTION_LABELS[r.action] || r.action}
                    </span>
                  </td>
                  <td className="text-xs max-w-[300px] truncate" style={{ color: "var(--ds-text-faint)" }}>
                    {detailsText(r.action, r.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination totalItems={filtered.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
    </div>
  );
}
