import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth, api, getToken, setToken } from "./api";
import type { User } from "./api";
import type { PortalRolePermission } from "@/hooks/usePortalRolePermissions";
import type { ProjectRoleType } from "@/types";

export interface ProjectMembership {
  project_id: string;
  project_role: ProjectRoleType | null;
  role: string;
  project_name: string;
  project_description: string | null;
}

export interface CompanyMembership {
  id: string;
  name: string;
  my_role: string;
}

export interface ProfileName {
  last_name: string;
  first_name: string;
  middle_name: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isPortalAdmin: boolean;
  isGlobalReader: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  portalRolePerms: PortalRolePermission[];
  projectMemberships: ProjectMembership[];
  companies: CompanyMembership[];
  profileName: ProfileName | null;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isPortalAdmin: false,
  isGlobalReader: false,
  mustChangePassword: false,
  clearMustChangePassword: () => {},
  portalRolePerms: [],
  projectMemberships: [],
  companies: [],
  profileName: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPortalAdmin, setIsPortalAdmin] = useState(false);
  const [isGlobalReader, setIsGlobalReader] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [portalRolePerms, setPortalRolePerms] = useState<PortalRolePermission[]>([]);
  const [projectMemberships, setProjectMemberships] = useState<ProjectMembership[]>([]);
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [profileName, setProfileName] = useState<ProfileName | null>(null);

  useEffect(() => {
    let unmounted = false;

    function resetState() {
      if (unmounted) return;
      setUser(null);
      setIsPortalAdmin(false);
      setIsGlobalReader(false);
      setMustChangePassword(false);
      setPortalRolePerms([]);
      setProjectMemberships([]);
      setCompanies([]);
      setProfileName(null);
      setLoading(false);
    }

    function forceSignOut() {
      auth.signOut();
      resetState();
    }

    // Таймаут на случай зависания (мобильный интернет)
    const sessionTimeout = setTimeout(forceSignOut, 8000);

    // Проверяем наличие токена и загружаем startup data
    const token = getToken();
    if (token) {
      loadStartupWithUser()
        .then((loadedUser) => {
          clearTimeout(sessionTimeout);
          if (unmounted) return;
          if (loadedUser) {
            setUser(loadedUser);
          } else {
            forceSignOut();
          }
        })
        .catch(() => {
          clearTimeout(sessionTimeout);
          if (!unmounted) forceSignOut();
        });
    } else {
      clearTimeout(sessionTimeout);
      setLoading(false);
    }

    // Подписка на auth-события (login/logout из других вкладок и т.д.)
    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      if (unmounted) return;

      if (event === "TOKEN_REFRESHED" && !session) {
        forceSignOut();
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        loadStartupData();
        return;
      }

      if (event === "SIGNED_OUT") {
        resetState();
        return;
      }

      // TOKEN_REFRESHED с новым токеном — обновляем данные
      if (session?.user) {
        setUser(session.user);
        loadStartupData();
      } else {
        resetState();
      }
    });

    return () => {
      unmounted = true;
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Загружает /api/auth/me + /api/auth/startup одновременно.
   * Возвращает User если всё ок, null если сессия невалидна.
   */
  async function loadStartupWithUser(): Promise<User | null> {
    try {
      const withTimeout = <T,>(promise: Promise<T>, ms = 10000): Promise<T> =>
        Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Таймаут")), ms))]);

      const [meResult, startupResult] = await withTimeout(
        Promise.all([
          api.get<User>('/api/auth/me'),
          api.get<{
            profile: {
              is_portal_admin: boolean;
              is_global_reader: boolean;
              must_change_password: boolean;
              last_name: string;
              first_name: string;
              middle_name: string | null;
            };
            memberships: ProjectMembership[];
            portal_role_permissions: PortalRolePermission[];
            companies: CompanyMembership[];
          }>('/api/auth/startup'),
        ])
      );

      if (!meResult.data) return null;

      if (startupResult.data) {
        applyStartupData(startupResult.data);
      }
      setLoading(false);
      return meResult.data;
    } catch {
      setLoading(false);
      return null;
    }
  }

  /**
   * Загружает только startup data (профиль уже известен).
   */
  async function loadStartupData() {
    try {
      const withTimeout = <T,>(promise: Promise<T>, ms = 10000): Promise<T> =>
        Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Таймаут")), ms))]);

      const { data } = await withTimeout(
        api.get<{
          profile: {
            is_portal_admin: boolean;
            is_global_reader: boolean;
            must_change_password: boolean;
            last_name: string;
            first_name: string;
            middle_name: string | null;
          };
          memberships: ProjectMembership[];
          portal_role_permissions: PortalRolePermission[];
        }>('/api/auth/startup')
      );

      if (data) {
        applyStartupData(data);
      }
    } catch {
      // При ошибке — безопасные дефолты уже установлены
    } finally {
      setLoading(false);
    }
  }

  function applyStartupData(data: {
    profile: {
      is_portal_admin: boolean;
      is_global_reader: boolean;
      must_change_password: boolean;
      last_name: string;
      first_name: string;
      middle_name: string | null;
    };
    memberships: ProjectMembership[];
    portal_role_permissions: PortalRolePermission[];
    companies: CompanyMembership[];
  }) {
    const profile = data.profile ?? {};
    setIsPortalAdmin(profile.is_portal_admin ?? false);
    setIsGlobalReader(profile.is_global_reader ?? false);
    setMustChangePassword(profile.must_change_password ?? false);
    setProfileName(
      profile.last_name
        ? {
            last_name: profile.last_name,
            first_name: profile.first_name,
            middle_name: profile.middle_name ?? null,
          }
        : null
    );
    setPortalRolePerms((data.portal_role_permissions ?? []) as PortalRolePermission[]);
    setProjectMemberships((data.memberships ?? []) as ProjectMembership[]);
    setCompanies((data.companies ?? []) as CompanyMembership[]);
  }

  function clearMustChangePassword() {
    setMustChangePassword(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPortalAdmin,
        isGlobalReader,
        mustChangePassword,
        clearMustChangePassword,
        portalRolePerms,
        projectMemberships,
        companies,
        profileName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
