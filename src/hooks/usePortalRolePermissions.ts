import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectRoleType, PermissionKey } from "@/types";
import { ROLE_DEFAULT_PERMISSIONS } from "@/types";

export interface PortalRolePermission {
  id: string;
  role: ProjectRoleType;
  // Страница проекта
  can_view_tasks: boolean;
  can_view_requests: boolean;
  can_view_admin: boolean;
  can_print: boolean;
  // Вкладки сайдбара
  can_view_installation: boolean;
  can_view_materials: boolean;
  can_view_registry: boolean;
  can_view_gro: boolean;
  can_view_fileshare: boolean;
  can_view_explorer: boolean;
  can_view_construction: boolean;
  // Реестр — просмотр
  can_view_cell: boolean;
  can_view_files_block: boolean;
  can_view_remarks_block: boolean;
  can_view_supervision_block: boolean;
  can_view_scan_block: boolean;
  can_view_process_block: boolean;
  can_view_comments_block: boolean;
  can_preview_files: boolean;
  // Реестр — действия
  can_create_cells: boolean;
  can_edit_cell: boolean;
  can_delete_cell: boolean;
  can_edit_mask: boolean;
  can_add_update_files: boolean;
  can_add_update_supervision: boolean;
  can_add_update_scan: boolean;
  can_add_comments: boolean;
  can_send_cells: boolean;
  can_archive: boolean;
  can_download_files: boolean;
  can_change_status: boolean;
  // Проверка и подпись
  can_remark: boolean;
  can_sign: boolean;
  can_supervise: boolean;
  can_acknowledge: boolean;
  // ГРО
  can_create_gro: boolean;
  can_edit_gro: boolean;
  can_delete_gro: boolean;
  can_add_gro_files: boolean;
  can_change_gro_status: boolean;
  // Заявки
  can_create_requests: boolean;
  can_edit_requests: boolean;
  can_add_request_files: boolean;
  can_delete_requests: boolean;
  can_execute_requests: boolean;
  can_change_request_status: boolean;
}

/**
 * Возвращает портальные разрешения по ролям.
 * Если передан initialData (например из AuthContext) — не делает запрос к БД.
 * Если для роли есть запись в таблице — используем её,
 * иначе — захардкоженные ROLE_DEFAULT_PERMISSIONS.
 */
export function usePortalRolePermissions(initialData?: PortalRolePermission[]) {
  const [rows, setRows] = useState<PortalRolePermission[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("portal_role_permissions")
      .select("*");
    setRows((data || []) as PortalRolePermission[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialData) load();
  }, [load, initialData]);

  /** Эффективное разрешение роли (портальное переопределение → дефолт) */
  function getRolePermission(role: ProjectRoleType, key: PermissionKey): boolean {
    const row = rows.find((r) => r.role === role);
    if (row) return row[key] as boolean;
    return ROLE_DEFAULT_PERMISSIONS[role]?.[key] ?? false;
  }

  /** Полная карта разрешений роли */
  function getRolePermissions(role: ProjectRoleType): Record<PermissionKey, boolean> {
    const row = rows.find((r) => r.role === role);
    if (row) {
      const result = {} as Record<PermissionKey, boolean>;
      for (const key of Object.keys(ROLE_DEFAULT_PERMISSIONS[role]) as PermissionKey[]) {
        result[key] = row[key] as boolean;
      }
      return result;
    }
    return { ...ROLE_DEFAULT_PERMISSIONS[role] };
  }

  return { rows, loading, reload: load, getRolePermission, getRolePermissions };
}
