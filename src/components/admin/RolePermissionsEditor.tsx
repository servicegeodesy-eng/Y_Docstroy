import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectRoleType, PermissionKey } from "@/types";
import { PROJECT_ROLES, ROLE_DEFAULT_PERMISSIONS, NO_ROLE_DEFAULT_PERMISSIONS } from "@/types";
import type { PortalRolePermission } from "@/hooks/usePortalRolePermissions";

/** Группы разрешений для визуальной организации */
const PERMISSION_GROUPS: { group: string; cols: { key: PermissionKey; label: string; desc: string }[] }[] = [
  {
    group: "Страница проекта",
    cols: [
      { key: "can_view_tasks", label: "Вкладка «Задачи»", desc: "Отображение вкладки Задачи и соответствующих инструкций" },
      { key: "can_view_requests", label: "Вкладка «Заявки»", desc: "Отображение вкладки Заявки и соответствующих инструкций" },
      { key: "can_view_admin", label: "Вкладка «Админ»", desc: "Отображение вкладки Админ и соответствующей инструкции" },
      { key: "can_print", label: "Печать", desc: "Отображение кнопки печати" },
    ],
  },
  {
    group: "Реестр — просмотр",
    cols: [
      { key: "can_view_cell", label: "Открытие ячейки", desc: "Открытие и просмотр содержимого ячейки" },
      { key: "can_view_files_block", label: "Блок Файлы", desc: "Отображение блока файлов в ячейке и столбца файлов в реестре" },
      { key: "can_view_remarks_block", label: "Блок Замечания", desc: "Отображение блока замечаний в ячейке" },
      { key: "can_view_supervision_block", label: "Блок Согласование АН", desc: "Отображение блока согласования авторского надзора" },
      { key: "can_view_scan_block", label: "Блок Скан", desc: "Отображение блока сканов в ячейке" },
      { key: "can_view_process_block", label: "Блок Процесс", desc: "Отображение блока процесса в ячейке" },
      { key: "can_view_comments_block", label: "Блок Комментарии", desc: "Отображение блока комментариев в ячейке" },
      { key: "can_preview_files", label: "Просмотр файлов", desc: "Просмотр PDF и картинок в ячейках" },
    ],
  },
  {
    group: "Реестр — действия",
    cols: [
      { key: "can_create_cells", label: "Создание ячейки", desc: "Создание/добавление новой ячейки в реестр" },
      { key: "can_edit_cell", label: "Редактирование", desc: "Редактирование содержимого ячейки" },
      { key: "can_delete_cell", label: "Удаление", desc: "Удаление ячейки из реестра" },
      { key: "can_edit_mask", label: "Маски", desc: "Создание и редактирование масок на подложках" },
      { key: "can_add_update_files", label: "Файлы", desc: "Добавление и обновление файлов ячейки" },
      { key: "can_add_update_supervision", label: "Согласование АН", desc: "Добавление и обновление файлов согласования АН" },
      { key: "can_add_update_scan", label: "Сканы", desc: "Добавление и обновление файлов сканов" },
      { key: "can_add_comments", label: "Комментарии", desc: "Добавление комментариев в ячейку" },
      { key: "can_send_cells", label: "Отправка", desc: "Отправка на проверку, ознакомление, согласование" },
      { key: "can_archive", label: "Архивация", desc: "Отправка в архив с прикреплением скана" },
      { key: "can_download_files", label: "Скачивание", desc: "Скачивание файлов, замечаний, сканов" },
      { key: "can_change_status", label: "Смена статуса", desc: "Изменение статуса ячейки вручную" },
    ],
  },
  {
    group: "Проверка и подпись",
    cols: [
      { key: "can_remark", label: "Замечания", desc: "Давать замечания с прикреплением файлов" },
      { key: "can_sign", label: "Подпись", desc: "Подписать / с замечанием / переслать" },
      { key: "can_supervise", label: "Авт. надзор", desc: "Согласовать / на исправление" },
      { key: "can_acknowledge", label: "Ознакомление", desc: "Принимать / ознакамливаться" },
    ],
  },
  {
    group: "ГРО",
    cols: [
      { key: "can_create_gro", label: "Создание ГРО", desc: "Создание ячейки ГРО" },
      { key: "can_edit_gro", label: "Редактирование ГРО", desc: "Редактирование ячейки ГРО" },
      { key: "can_delete_gro", label: "Удаление ГРО", desc: "Удаление ячейки ГРО" },
      { key: "can_add_gro_files", label: "Файлы ГРО", desc: "Добавление/обновление файлов ГРО" },
      { key: "can_change_gro_status", label: "Статус ГРО", desc: "Изменение статуса ГРО вручную" },
    ],
  },
  {
    group: "Заявки",
    cols: [
      { key: "can_create_requests", label: "Создание", desc: "Создание/добавление заявки" },
      { key: "can_edit_requests", label: "Редактирование", desc: "Редактирование заявки" },
      { key: "can_add_request_files", label: "Файлы", desc: "Добавление файлов в заявки" },
      { key: "can_delete_requests", label: "Удаление", desc: "Удаление заявки" },
      { key: "can_execute_requests", label: "Выполнение", desc: "Выполнение/отклонение заявки" },
      { key: "can_change_request_status", label: "Статус заявки", desc: "Изменение статуса заявки вручную" },
    ],
  },
];

const ALL_PERM_COLS = PERMISSION_GROUPS.flatMap((g) => g.cols);

/** Виртуальный ключ для «без роли» */
const NO_ROLE_KEY = '__no_role__' as const;
type DisplayRole = ProjectRoleType | typeof NO_ROLE_KEY;
const ALL_DISPLAY_ROLES: DisplayRole[] = [...PROJECT_ROLES, NO_ROLE_KEY];
const NO_ROLE_DB_VALUE = 'Без роли';

function displayRoleName(role: DisplayRole): string {
  return role === NO_ROLE_KEY ? 'Без роли' : role;
}

interface Props {
  onClose: () => void;
}

type EditorTab = "settings" | "reference";

export default function RolePermissionsEditor({ onClose }: Props) {
  const [rows, setRows] = useState<PortalRolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [showAddRole, setShowAddRole] = useState(false);
  const [tab, setTab] = useState<EditorTab>("settings");
  const [activeGroup, setActiveGroup] = useState(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase.from("portal_role_permissions").select("*");
    setRows((data || []) as PortalRolePermission[]);
    setLoading(false);
  }

  function getDbRole(role: DisplayRole): string {
    return role === NO_ROLE_KEY ? NO_ROLE_DB_VALUE : role;
  }

  function getDefaults(role: DisplayRole): Record<PermissionKey, boolean> {
    if (role === NO_ROLE_KEY) return NO_ROLE_DEFAULT_PERMISSIONS;
    return ROLE_DEFAULT_PERMISSIONS[role] ?? NO_ROLE_DEFAULT_PERMISSIONS;
  }

  function getValue(role: DisplayRole, key: PermissionKey): boolean {
    const dbRole = getDbRole(role);
    const row = rows.find((r) => r.role === dbRole);
    if (row && key in row) return row[key] as boolean;
    return getDefaults(role)[key] ?? false;
  }

  function isCustomized(role: DisplayRole): boolean {
    return rows.some((r) => r.role === getDbRole(role));
  }

  async function toggle(role: DisplayRole, key: PermissionKey) {
    const dbRole = getDbRole(role);
    setSaving(dbRole + key);
    const current = getValue(role, key);
    const existing = rows.find((r) => r.role === dbRole);

    if (existing) {
      await supabase
        .from("portal_role_permissions")
        .update({ [key]: !current, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const defaults = getDefaults(role);
      const insert: Record<string, unknown> = { role: dbRole };
      for (const col of ALL_PERM_COLS) {
        insert[col.key] = col.key === key ? !current : (defaults[col.key] ?? false);
      }
      await supabase.from("portal_role_permissions").insert(insert);
    }

    await loadData();
    setSaving(null);
  }

  async function resetRole(role: DisplayRole) {
    const name = displayRoleName(role);
    if (!confirm(`Сбросить разрешения роли «${name}» к значениям по умолчанию?`)) return;
    const dbRole = getDbRole(role);
    setSaving(dbRole);
    await supabase.from("portal_role_permissions").delete().eq("role", dbRole);
    await loadData();
    setSaving(null);
  }

  async function addCustomRole() {
    const name = newRoleName.trim();
    if (!name) return;
    setSaving("new");
    const insert: Record<string, unknown> = { role: name };
    for (const col of ALL_PERM_COLS) {
      insert[col.key] = false;
    }
    insert["can_view_tasks"] = true;
    insert["can_view_cell"] = true;
    insert["can_view_files_block"] = true;
    insert["can_preview_files"] = true;
    await supabase.from("portal_role_permissions").insert(insert);
    await loadData();
    setNewRoleName("");
    setShowAddRole(false);
    setSaving(null);
  }

  /** Кастомные роли (есть в БД, но нет в PROJECT_ROLES и не «Без роли») */
  const customRoles: string[] = rows
    .map((r) => r.role as string)
    .filter((r) => r !== NO_ROLE_DB_VALUE && !(PROJECT_ROLES as readonly string[]).includes(r));

  const allRoles: DisplayRole[] = [
    ...ALL_DISPLAY_ROLES,
    ...customRoles as DisplayRole[],
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--ds-surface)" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Настройка разрешений по ролям</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-faint)" }}>
            Глобальные дефолтные разрешения для каждой роли. Наведите на название для подсказки.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--ds-surface-sunken)" }}>
            <button
              onClick={() => setTab("settings")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tab === "settings" ? "ds-btn shadow-sm" : ""}`}
              style={tab !== "settings" ? { color: "var(--ds-text-muted)" } : undefined}
            >Настройка</button>
            <button
              onClick={() => setTab("reference")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tab === "reference" ? "ds-btn shadow-sm" : ""}`}
              style={tab !== "reference" ? { color: "var(--ds-text-muted)" } : undefined}
            >Справочник</button>
          </div>
          {tab === "settings" && (
            <button
              onClick={() => setShowAddRole(!showAddRole)}
              className="ds-btn-secondary px-3 py-1.5 text-sm"
            >
              + Новая роль
            </button>
          )}
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {tab === "settings" && <>
      {/* Форма добавления роли */}
      {showAddRole && (
        <div className="px-6 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}>
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Название новой роли..."
            className="ds-input text-sm flex-1 max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && addCustomRole()}
          />
          <button
            onClick={addCustomRole}
            disabled={!newRoleName.trim() || saving === "new"}
            className="ds-btn px-3 py-1.5 text-sm"
          >
            {saving === "new" ? "Создание..." : "Создать"}
          </button>
          <button onClick={() => { setShowAddRole(false); setNewRoleName(""); }} className="ds-btn-secondary px-3 py-1.5 text-sm">
            Отмена
          </button>
        </div>
      )}

      {/* Вкладки групп разрешений */}
      <div className="flex flex-wrap gap-1 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}>
        {PERMISSION_GROUPS.map((g, i) => (
          <button
            key={g.group}
            onClick={() => setActiveGroup(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeGroup === i ? "ds-btn shadow-sm" : "hover:bg-white/50"
            }`}
            style={activeGroup !== i ? { color: "var(--ds-text-muted)" } : undefined}
          >
            {g.group}
          </button>
        ))}
      </div>

      {/* Таблица */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center py-12" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
                <th className="text-left px-3 py-2 font-medium sticky left-0 z-20 min-w-[200px]" style={{ color: "var(--ds-text-muted)", background: "var(--ds-surface-sunken)", borderRight: "1px solid var(--ds-border)" }}>Роль</th>
                {PERMISSION_GROUPS[activeGroup].cols.map((col) => (
                  <th
                    key={col.key}
                    className="text-center px-2 py-2 font-medium min-w-[70px] cursor-help"
                    style={{ color: "var(--ds-text-muted)" }}
                    title={col.desc}
                  >
                    <span style={{ borderBottom: "1px dotted var(--ds-text-faint)" }}>{col.label}</span>
                  </th>
                ))}
                <th className="text-center px-2 py-2 font-medium min-w-[50px]" style={{ color: "var(--ds-text-muted)" }}>Сброс</th>
              </tr>
            </thead>
            <tbody>
              {allRoles.map((role) => {
                const dbRole = getDbRole(role);
                const isBusy = saving?.startsWith(dbRole) ?? false;
                const customized = isCustomized(role);
                const isLocked = role === 'Администратор';
                const isCustom = typeof role === 'string' && customRoles.includes(role as string);
                const name = displayRoleName(role);
                return (
                  <tr key={dbRole} style={{ borderBottom: "1px solid var(--ds-border)" }}>
                    <td className="px-4 py-1.5 sticky left-0 z-10" style={{ background: "var(--ds-surface)", borderRight: "1px solid var(--ds-border)" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs" style={{ color: role === NO_ROLE_KEY ? "var(--ds-text-faint)" : "var(--ds-text)" }}>{name}</span>
                        {isLocked && (
                          <span className="inline-block px-1 py-0.5 rounded text-[9px] leading-none" style={{ background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" }}>портал</span>
                        )}
                        {isCustom && (
                          <span className="inline-block px-1 py-0.5 rounded text-[9px] leading-none" style={{ background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" }}>новая</span>
                        )}
                        {customized && !isLocked && !isCustom && (
                          <span className="inline-block px-1 py-0.5 rounded text-[9px] leading-none" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>изм.</span>
                        )}
                      </div>
                    </td>
                    {PERMISSION_GROUPS[activeGroup].cols.map((col) => {
                      const isOn = isLocked ? true : getValue(role, col.key);
                      return (
                        <td key={col.key} className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => !isLocked && toggle(role, col.key)}
                            disabled={isBusy || isLocked}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${isBusy ? "opacity-50" : ""}`}
                            style={isOn ? { background: "var(--ds-accent)" } : { background: "var(--ds-border-strong)" }}
                            title={isLocked ? "Администратор портала — все разрешения включены" : col.desc}
                          >
                            <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center">
                      {customized && !isLocked && (
                        <button
                          onClick={() => resetRole(role)}
                          disabled={isBusy}
                          className="transition-colors"
                          style={{ color: "var(--ds-text-faint)" }}
                          title={isCustom ? "Удалить роль" : "Сбросить к значениям по умолчанию"}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      </>}

      {/* Вкладка справочник */}
      {tab === "reference" && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="max-w-3xl space-y-6">
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.group}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>{g.group}</h3>
                <div className="space-y-2">
                  {g.cols.map((col) => (
                    <div key={col.key} className="flex gap-3 px-4 py-2.5 rounded-lg" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
                      <div className="shrink-0 w-40">
                        <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{col.label}</span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>{col.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
