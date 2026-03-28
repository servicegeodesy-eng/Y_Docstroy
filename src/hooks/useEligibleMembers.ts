import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import type { Profile, ProjectRoleType, UserPermission, PermissionKey } from "@/types";
import { ROLE_DEFAULT_PERMISSIONS, ROLES } from "@/types";
import type { PortalRolePermission } from "@/hooks/usePortalRolePermissions";

export interface MemberProfile {
  user_id: string;
  project_role: ProjectRoleType | null;
  profiles: Profile;
}

// Кэш: project_id:permissionKey → { data, timestamp }
const cache = new Map<string, { data: MemberProfile[]; ts: number }>();
const CACHE_TTL = 30_000; // 30 секунд

function hasPermissionForRole(
  permKey: PermissionKey,
  role: ProjectRoleType | null,
  perms: UserPermission | null,
  portalRolePerms: PortalRolePermission[],
): boolean {
  if (role === ROLES.PROJECT_ADMIN) return true;
  // 1. Индивидуальные переопределения
  if (perms) {
    const val = perms[permKey];
    if (val !== undefined && val !== null) return val as boolean;
  }
  // 2. Портальные настройки роли
  if (role) {
    const portalRow = portalRolePerms.find((r) => r.role === role);
    if (portalRow) {
      return portalRow[permKey] as boolean;
    }
  }
  // 3. Хардкоженные дефолты
  if (role && ROLE_DEFAULT_PERMISSIONS[role]) {
    return ROLE_DEFAULT_PERMISSIONS[role][permKey] ?? false;
  }
  return false;
}

export function useEligibleMembers(permissionKey: PermissionKey) {
  const { project } = useProject();
  const { user, portalRolePerms } = useAuth();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!project || !user) return;

    const cacheKey = `${project.id}:${permissionKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setMembers(cached.data);
      setLoading(false);
      return;
    }

    async function load() {
      const [membersRes, permsRes] = await Promise.all([
        supabase
          .from("project_members")
          .select("user_id, project_role, profiles(id, last_name, first_name, middle_name)")
          .eq("project_id", project!.id)
          .neq("user_id", user!.id),
        supabase
          .from("user_permissions")
          .select("*")
          .eq("project_id", project!.id),
      ]);

      const permsMap = new Map<string, UserPermission>();
      for (const p of (permsRes.data || []) as UserPermission[]) {
        permsMap.set(p.user_id, p);
      }

      const allMembers = (membersRes.data || []) as unknown as MemberProfile[];
      const eligible = allMembers.filter((m) =>
        hasPermissionForRole(permissionKey, m.project_role, permsMap.get(m.user_id) || null, portalRolePerms),
      );

      cache.set(cacheKey, { data: eligible, ts: Date.now() });

      if (mountedRef.current) {
        setMembers(eligible);
        setLoading(false);
      }
    }

    load();
  }, [project, user, permissionKey, portalRolePerms]);

  return { members, loading };
}

/** Сбросить кэш (вызывать после изменения разрешений) */
export function invalidateEligibleMembersCache() {
  cache.clear();
}
