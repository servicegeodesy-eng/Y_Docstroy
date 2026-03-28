import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import type { Project, ProjectMember, UserPermission, PermissionKey, ProjectRoleType } from "@/types";
import { ROLE_DEFAULT_PERMISSIONS, ROLES } from "@/types";

interface ProjectContextType {
  project: Project | null;
  membership: ProjectMember | null;
  permissions: UserPermission | null;
  loading: boolean;
  loadError: string | null;
  isAdmin: boolean;
  isProjectAdmin: boolean;
  isPortalAdmin: boolean;
  userRole: ProjectRoleType | null;
  hasPermission: (key: PermissionKey) => boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  project: null,
  membership: null,
  permissions: null,
  loading: true,
  loadError: null,
  isAdmin: false,
  isProjectAdmin: false,
  isPortalAdmin: false,
  userRole: null,
  hasPermission: () => false,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams();
  const { user, isPortalAdmin: isPortalAdminUser, portalRolePerms } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [membership, setMembership] = useState<ProjectMember | null>(null);
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;

    async function load() {
      try {
        const withTimeout = <T,>(promise: Promise<T>, ms = 10000): Promise<T> =>
          Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Таймаут загрузки")), ms))]);

        const [projectRes, memberRes, permRes] = await withTimeout(Promise.all([
          supabase.from("projects").select("*").eq("id", projectId).single(),
          supabase
            .from("project_members")
            .select("*")
            .eq("project_id", projectId)
            .eq("user_id", user!.id)
            .maybeSingle(),
          supabase
            .from("user_permissions")
            .select("*")
            .eq("project_id", projectId!)
            .eq("user_id", user!.id)
            .maybeSingle(),
        ]));

        if (projectRes.error) throw new Error("Не удалось загрузить данные проекта");

        setProject(projectRes.data);
        setMembership(memberRes.data);
        setPermissions(permRes.data);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Ошибка загрузки проекта");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId, user]);

  const isAdmin = isPortalAdminUser;

  const isProjectAdmin =
    isAdmin || membership?.project_role === ROLES.PROJECT_ADMIN || membership?.project_role === ROLES.ADMIN;

  const userRole = membership?.project_role ?? null;

  const hasPermission = useCallback(
    (key: PermissionKey): boolean => {
      if (isPortalAdminUser) return true;
      if (membership?.project_role === ROLES.ADMIN) {
        return true;
      }
      if (membership?.project_role === ROLES.PROJECT_ADMIN) {
        return key !== "can_change_status" && key !== "can_change_gro_status" && key !== "can_change_request_status";
      }

      // Индивидуальное разрешение (приоритет)
      if (permissions) {
        const individual = permissions[key];
        if (individual !== undefined && individual !== null) {
          return individual as boolean;
        }
      }

      // Разрешения заявок: для обычных ролей только индивидуальные (user_permissions).
      // Роль определяет кто МОЖЕТ получить доступ, но проект-админ должен включить явно.
      const REQUEST_KEYS: PermissionKey[] = [
        "can_view_requests", "can_create_requests", "can_edit_requests",
        "can_add_request_files", "can_delete_requests", "can_execute_requests",
        "can_change_request_status",
      ];
      if (REQUEST_KEYS.includes(key)) {
        return false;
      }

      // Портальные настройки роли (из AuthContext — загружены один раз)
      if (userRole) {
        const portalRow = portalRolePerms.find((r) => r.role === userRole);
        if (portalRow) {
          return portalRow[key] as boolean;
        }
      }

      // Дефолт роли (захардкоженные)
      if (userRole && ROLE_DEFAULT_PERMISSIONS[userRole]) {
        return ROLE_DEFAULT_PERMISSIONS[userRole][key] ?? false;
      }

      return false;
    },
    [isPortalAdminUser, membership, permissions, userRole, portalRolePerms]
  );

  return (
    <ProjectContext.Provider
      value={{
        project,
        membership,
        permissions,
        loading,
        loadError,
        isAdmin,
        isProjectAdmin,
        isPortalAdmin: isPortalAdminUser,
        userRole,
        hasPermission,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
