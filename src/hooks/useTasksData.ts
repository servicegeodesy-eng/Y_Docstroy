import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import type { TaskCell } from "@/components/tasks/ActiveTable";
import type { ShareRow } from "@/components/tasks/HistoryTable";

type TabKey = "all" | "incoming" | "outgoing" | "history_all" | "history_in" | "history_out";

export function useTasksData(activeTab: TabKey) {
  const { project, hasPermission, isProjectAdmin } = useProject();
  const { user } = useAuth();

  const [cells, setCells] = useState<TaskCell[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [pendingAckCellIds, setPendingAckCellIds] = useState<Set<string>>(new Set());
  const [requestsBadge, setRequestsBadge] = useState(0);
  const [filesBadge, setFilesBadge] = useState(0);

  const loadData = useCallback(async () => {
    if (!project || !user) return;
    setLoading(true);

    const [cellsRes, sharesRes, archivesRes, ackRes] = await Promise.all([
      supabase
        .from("cells")
        .select(`
          id, name, status, progress_percent, created_at, created_by, assigned_to, assigned_by, original_sender_id, send_type,
          dict_work_types(name),
          cell_files(id, file_name, storage_path, category),
          creator:profiles!created_by(last_name, first_name, middle_name),
          assignee:profiles!assigned_to(last_name, first_name, middle_name),
          assigner:profiles!assigned_by(last_name, first_name, middle_name)
        `)
        .eq("project_id", project.id)
        .eq("cell_type", "registry")
        .order("created_at", { ascending: false })
        .limit(500),
      // Один запрос вместо двух: все shares где я отправитель или получатель
      supabase
        .from("cell_shares")
        .select(`
          id, created_at, message, cell_id, from_user_id, to_user_id, share_type,
          cells(id, name, status, dict_work_types(name), cell_files(id, file_name, storage_path, category)),
          from_profile:profiles!from_user_id(last_name, first_name, middle_name),
          to_profile:profiles!to_user_id(last_name, first_name, middle_name)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("cell_archives")
        .select("cell_id")
        .eq("user_id", user.id),
      supabase
        .from("cell_signatures")
        .select("cell_id")
        .eq("user_id", user.id)
        .eq("status", "Ознакомлен"),
    ]);

    // Построить карту последних сообщений для входящих ячеек
    const lastMessageMap = new Map<string, string>();
    if (sharesRes.data) {
      const allShares = sharesRes.data as unknown as (ShareRow & { share_type?: string })[];
      setShares(allShares);
      for (const s of allShares) {
        if (s.to_user_id === user.id && s.message && !lastMessageMap.has(s.cell_id)) {
          lastMessageMap.set(s.cell_id, s.message);
        }
      }
    }
    if (cellsRes.data) {
      const enriched = (cellsRes.data as unknown as TaskCell[]).map((c) => ({
        ...c,
        lastMessage: lastMessageMap.get(c.id) || null,
      }));
      setCells(enriched);
    }
    if (archivesRes.data) {
      setArchivedIds(new Set(archivesRes.data.map((a: { cell_id: string }) => a.cell_id)));
    }
    if (ackRes.data) {
      setAcknowledgedIds(new Set(ackRes.data.map((a: { cell_id: string }) => a.cell_id)));
    }
    // Вычислить pending ознакомления из объединённого shares запроса
    const myAckedSet = new Set((ackRes.data || []).map((a: { cell_id: string }) => a.cell_id));
    const ackShares = (sharesRes.data || []) as unknown as { cell_id: string; to_user_id: string; share_type?: string }[];
    const ackShareCellIds = ackShares
      .filter((s) => s.to_user_id === user.id && s.share_type === "acknowledge")
      .map((s) => s.cell_id);
    setPendingAckCellIds(new Set(ackShareCellIds.filter((id) => !myAckedSet.has(id))));

    setLoading(false);
  }, [project, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Счётчики для бейджей на вкладках разделов
  const canExecReq = hasPermission("can_execute_requests");
  useEffect(() => {
    if (!project || !user) return;
    // Заявки
    Promise.all([
      supabase.from("cells").select("id, created_by, assigned_to, status").eq("project_id", project.id).eq("cell_type", "request").in("status", ["В работе", "Выполнено", "Отклонено"]),
      supabase.from("cell_history").select("cell_id").eq("user_id", user.id).eq("action", "request_acknowledged"),
    ]).then(([reqRes, ackRes]) => {
      const ackIds = new Set((ackRes.data || []).map((a: { cell_id: string }) => a.cell_id));
      let c = 0;
      for (const r of (reqRes.data || []) as { id: string; created_by: string; assigned_to: string | null; status: string }[]) {
        if (r.status === "В работе" && canExecReq && (r.assigned_to === user.id || !r.assigned_to)) c++;
        else if ((r.status === "Выполнено" || r.status === "Отклонено") && r.created_by === user.id && !ackIds.has(r.id)) c++;
      }
      setRequestsBadge(c);
    });
    // Файлы: непрочитанные входящие
    supabase.from("file_shares").select("id, created_by, status, file_share_recipients(user_id, is_read, trashed_at)").eq("project_id", project.id).eq("status", "sent").then(({ data }) => {
      if (!data) return;
      let c = 0;
      for (const s of data as unknown as { id: string; created_by: string; file_share_recipients: { user_id: string; is_read: boolean; trashed_at: string | null }[] }[]) {
        if (s.created_by === user.id) continue;
        if (s.file_share_recipients.some((r) => r.user_id === user.id && !r.trashed_at && !r.is_read)) c++;
      }
      setFilesBadge(c);
    });
  }, [project, user, canExecReq]);

  // --- Permission helpers ---
  function canReview(cell: TaskCell): boolean {
    return !!user && cell.assigned_to === user.id && cell.send_type === "review"
      && (hasPermission("can_sign") || hasPermission("can_remark"));
  }

  function canSupervise(cell: TaskCell): boolean {
    return !!user && cell.assigned_to === user.id
      && cell.send_type === "supervision"
      && hasPermission("can_supervise");
  }

  function canArchive(cell: TaskCell): boolean {
    if (!user || archivedIds.has(cell.id) || !hasPermission("can_archive")) return false;
    if (cell.status === "Окончательно утверждён") return false;
    const hasScan = cell.cell_files.some((f) => f.category === "archive_scan");
    // Администратор проекта может всегда архивировать
    if (isProjectAdmin) return cell.assigned_to === user.id;
    // Если скан уже прикреплён — разрешить архивацию
    if (hasScan && cell.assigned_to === user.id) return true;
    // Исполнитель — только свои ячейки и только после подписания
    return cell.assigned_to === user.id
      && cell.created_by === user.id
      && (cell.status === "Подписано" || cell.status === "Подписано с замечанием");
  }

  function canAcknowledgeCell(cell: TaskCell): boolean {
    return !!user
      && pendingAckCellIds.has(cell.id)
      && !acknowledgedIds.has(cell.id)
      && hasPermission("can_acknowledge");
  }

  function canSendCells(cell: TaskCell): boolean {
    return !!user && hasPermission("can_send_cells") && cell.assigned_to === user.id
      && (isProjectAdmin || cell.created_by === user.id)
      && !cell.send_type
      && cell.status !== "Окончательно утверждён";
  }

  function hasAnyAction(cell: TaskCell): boolean {
    return canReview(cell) || canSupervise(cell) || canArchive(cell)
      || canSendCells(cell) || canAcknowledgeCell(cell);
  }

  function getReturnTo(cell: TaskCell): string {
    return cell.created_by;
  }

  async function handleSign(cell: TaskCell) {
    if (!user) return;
    const returnTo = getReturnTo(cell);
    await supabase.from("cell_signatures").insert({
      cell_id: cell.id, user_id: user.id, status: "Подписано", signed_at: new Date().toISOString(),
    });
    await supabase.from("cells").update({
      status: "Подписано", assigned_to: returnTo, assigned_by: user.id, send_type: null,
    }).eq("id", cell.id);
    await supabase.from("cell_shares").insert({
      cell_id: cell.id, from_user_id: user.id, to_user_id: returnTo,
      message: "Подписано",
    });
    await supabase.from("cell_history").insert({
      cell_id: cell.id, user_id: user.id, action: "signed", details: { status: "Подписано", to_user_id: returnTo },
    });
    loadData();
  }

  async function handleApproveSupervision(cell: TaskCell) {
    if (!user) return;
    const returnTo = getReturnTo(cell);
    await supabase.from("cell_signatures").insert({
      cell_id: cell.id, user_id: user.id, status: "Согласовано",
      signed_at: new Date().toISOString(),
    });
    await supabase.from("cells").update({
      status: "Согласовано", assigned_to: returnTo, assigned_by: user.id, send_type: null,
    }).eq("id", cell.id);
    await supabase.from("cell_shares").insert({
      cell_id: cell.id, from_user_id: user.id, to_user_id: returnTo,
      message: "Согласовано авторским надзором",
    });
    await supabase.from("cell_history").insert({
      cell_id: cell.id, user_id: user.id, action: "supervision_approved",
      details: { status: "Согласовано", to_user_id: returnTo },
    });
    loadData();
  }

  // --- Filtered data ---
  const filteredActive = useMemo(() => cells.filter((cell) => {
    if (!user) return false;
    if (cell.status === "Окончательно утверждён") return false;
    const isArchived = archivedIds.has(cell.id);
    const isNewOwn = cell.created_by === user.id && !cell.send_type && cell.assigned_to === user.id;
    const isReceivedByMe = cell.assigned_to === user.id && !!cell.send_type;
    const isSentByMe = cell.assigned_by === user.id && cell.assigned_to !== user.id && !!cell.send_type;
    const hasPendingAck = pendingAckCellIds.has(cell.id);
    let matchesTab = false;
    switch (activeTab) {
      case "incoming":
        matchesTab = ((isNewOwn || isReceivedByMe || (cell.assigned_to === user.id && !cell.send_type) || hasPendingAck) && !isArchived);
        break;
      case "outgoing":
        matchesTab = isSentByMe;
        break;
      default:
        matchesTab = (
          ((isNewOwn || isReceivedByMe || (cell.assigned_to === user.id && !cell.send_type) || hasPendingAck) && !isArchived) ||
          isSentByMe
        );
    }
    if (!matchesTab) return false;
    return hasAnyAction(cell) || isSentByMe;
  }), [cells, user, activeTab, archivedIds, acknowledgedIds, pendingAckCellIds]);

  // Счётчик только входящих (для бейджа на вкладке «Реестр» — всегда incoming, не зависит от activeTab)
  const incomingCount = useMemo(() => {
    if (!user) return 0;
    return cells.filter((cell) => {
      if (cell.status === "Окончательно утверждён") return false;
      const isArchived = archivedIds.has(cell.id);
      if (isArchived) return false;
      const isNewOwn = cell.created_by === user.id && !cell.send_type && cell.assigned_to === user.id;
      const isReceivedByMe = cell.assigned_to === user.id && !!cell.send_type;
      const hasPendingAck = pendingAckCellIds.has(cell.id);
      if (!(isNewOwn || isReceivedByMe || (cell.assigned_to === user.id && !cell.send_type) || hasPendingAck)) return false;
      return hasAnyAction(cell);
    }).length;
  }, [cells, user, archivedIds, acknowledgedIds, pendingAckCellIds]);

  const filteredHistory = useMemo(() => shares.filter((s) => {
    if (!user || !s.cells) return false;
    switch (activeTab) {
      case "history_in": return s.to_user_id === user.id;
      case "history_out": return s.from_user_id === user.id;
      default: return true;
    }
  }), [shares, user, activeTab]);

  return {
    cells,
    loading,
    loadData,
    filteredActive,
    filteredHistory,
    incomingCount,
    requestsBadge,
    filesBadge,
    archivedIds,
    setArchivedIds,
    // Permission helpers
    canReview,
    canSupervise,
    canArchive,
    canAcknowledgeCell,
    canSendCells,
    hasAnyAction,
    getReturnTo,
    // Action handlers
    handleSign,
    handleApproveSupervision,
    hasPermission,
  };
}
