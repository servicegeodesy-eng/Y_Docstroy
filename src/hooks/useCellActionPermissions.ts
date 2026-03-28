import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import type { CellActionKey, CellActionPermission } from "@/types";
import { ROLES } from "@/types";

interface CellContext {
  created_by: string | null;
  assigned_to: string | null;
}

async function fetchPermissions(projectId: string): Promise<CellActionPermission[]> {
  const seedKey = `seeded_cap_${projectId}`;
  if (!sessionStorage.getItem(seedKey)) {
    await supabase.rpc("seed_cell_action_permissions", { p_project_id: projectId });
    sessionStorage.setItem(seedKey, "1");
  }

  const { data } = await supabase
    .from("cell_action_permissions")
    .select("*")
    .eq("project_id", projectId);

  return (data || []) as CellActionPermission[];
}

export function useCellActionPermissions() {
  const { project, userRole, isProjectAdmin, isPortalAdmin } = useProject();
  const { user } = useAuth();
  const pid = project?.id;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cellActionPermissions", pid],
    queryFn: () => fetchPermissions(pid!),
    enabled: !!pid,
    staleTime: 10 * 60 * 1000,
  });

  const canDo = useCallback(
    (action: CellActionKey, cellStatus: string, cell: CellContext): boolean => {
      if (isPortalAdmin) return true;
      if (userRole === ROLES.ADMIN) return true;
      if (!user || !cellStatus) return false;

      let context: string;
      if (isProjectAdmin || userRole === ROLES.PROJECT_ADMIN) {
        context = "Администратор проекта";
      } else if (cell.created_by && cell.created_by === user.id) {
        context = "__cell_creator__";
      } else if (cell.assigned_to && cell.assigned_to === user.id) {
        context = "__inbox_task__";
      } else {
        context = "__others__";
      }

      const row = rows.find(
        (r) => r.role_context === context && r.status_name === cellStatus,
      );
      return row ? (row as unknown as Record<string, unknown>)[action] === true : false;
    },
    [rows, user, userRole, isProjectAdmin, isPortalAdmin],
  );

  return { canDo, loading: isLoading };
}
