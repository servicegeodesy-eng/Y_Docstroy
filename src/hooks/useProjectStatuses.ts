import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { ProjectRoleType } from "@/types";
import { ROLES } from "@/types";

export interface ProjectStatusWithRoles {
  id: string;
  project_id: string;
  name: string;
  color_key: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  allowed_roles: string[];
}

function mapData(data: Record<string, unknown>[] | null): ProjectStatusWithRoles[] {
  if (!data) return [];
  return data.map((s) => ({
    ...(s as unknown as ProjectStatusWithRoles),
    allowed_roles: ((s.status_role_assignments as { role: string }[] | null) || []).map(
      (a) => a.role,
    ),
  }));
}

async function fetchStatuses(projectId: string): Promise<ProjectStatusWithRoles[]> {
  const { data } = await supabase
    .from("project_statuses")
    .select("*, status_role_assignments(role)")
    .eq("project_id", projectId)
    .order("sort_order");

  if (data && data.length === 0) {
    await supabase.rpc("seed_default_statuses", { p_project_id: projectId });
    const { data: seeded } = await supabase
      .from("project_statuses")
      .select("*, status_role_assignments(role)")
      .eq("project_id", projectId)
      .order("sort_order");
    return mapData(seeded);
  }
  return mapData(data);
}

export function useProjectStatuses() {
  const { project, userRole: ctxRole } = useProject();
  const queryClient = useQueryClient();
  const pid = project?.id;

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["projectStatuses", pid],
    queryFn: () => fetchStatuses(pid!),
    enabled: !!pid,
    staleTime: 5 * 60 * 1000,
  });

  const statusMap = useMemo(() => {
    const map = new Map<string, ProjectStatusWithRoles>();
    for (const s of statuses) map.set(s.name, s);
    return map;
  }, [statuses]);

  function getColorKey(statusName: string): string {
    return statusMap.get(statusName)?.color_key || "gray";
  }

  function canAssignStatus(statusName: string, userRole: ProjectRoleType | null): boolean {
    if (userRole === ROLES.PROJECT_ADMIN) return true;
    const s = statusMap.get(statusName);
    if (!s) return false;
    if (s.allowed_roles.length === 0) return true;
    return userRole ? s.allowed_roles.includes(userRole) : false;
  }

  return {
    statuses,
    loading: isLoading,
    statusMap,
    getColorKey,
    canAssignStatus,
    userRole: ctxRole,
    reload: () => {
      queryClient.invalidateQueries({ queryKey: ["projectStatuses", pid] });
    },
  };
}
