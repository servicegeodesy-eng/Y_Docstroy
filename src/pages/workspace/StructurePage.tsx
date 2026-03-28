import {
  PROJECT_ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  DEFAULT_STATUS_NAMES,
  type PermissionKey,
  type ProjectRoleType,
} from "@/types";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { Navigate } from "react-router-dom";
import { useState } from "react";

/* ──────────────── Визуальные компоненты ──────────────── */

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold mb-4 pb-2" style={{ color: "var(--ds-text)", borderBottom: "2px solid var(--ds-accent)" }}>
      {children}
    </h2>
  );
}

function Box({ title, color, warn, children }: { title: string; color?: string; warn?: boolean; children?: React.ReactNode }) {
  const c = warn ? "#ef4444" : color || "var(--ds-accent)";
  return (
    <div className="rounded-lg p-3 text-sm" style={{ background: "var(--ds-surface-elevated)", border: `1px solid ${c}`, borderLeft: `4px solid ${c}` }}>
      <div className="font-semibold mb-1" style={{ color: c }}>{title}</div>
      {children && <div className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{children}</div>}
    </div>
  );
}

function Diamond({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="px-4 py-2 text-xs font-semibold text-center" style={{ background: "rgba(251,191,36,0.15)", border: "2px solid #f59e0b", color: "#f59e0b", borderRadius: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Arr({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center" style={{ color: "var(--ds-text-faint)" }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 4v12M6 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <span className="text-xs -mt-1">{label}</span>}
    </div>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium" style={{
      background: on ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)",
      color: on ? "#22c55e" : "rgba(239,68,68,0.5)",
    }}>{label}</span>
  );
}

function WarnBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <div className="text-sm font-semibold mb-2" style={{ color: "#ef4444" }}>{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-xs flex gap-2" style={{ color: "var(--ds-text-muted)" }}>
            <span style={{ color: "#ef4444" }}>!</span> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

const PERM_LABELS: Record<string, string> = {
  can_view_tasks: "Задачи", can_view_requests: "Заявки", can_view_admin: "Админ", can_print: "Печать",
  can_view_cell: "Ячейка", can_view_files_block: "Файлы", can_view_remarks_block: "Замечания",
  can_view_supervision_block: "АН", can_view_scan_block: "Сканы", can_view_process_block: "Процесс",
  can_view_comments_block: "Комменты", can_preview_files: "Предпросмотр", can_download_files: "Скачивание",
  can_create_cells: "Создание", can_edit_cell: "Редакт.", can_delete_cell: "Удаление",
  can_edit_mask: "Маски", can_add_update_files: "Файлы +", can_add_update_supervision: "АН +",
  can_add_update_scan: "Сканы +", can_add_comments: "Комменты +", can_send_cells: "Отправка",
  can_archive: "Архив", can_change_status: "Статус",
  can_remark: "Замечание", can_sign: "Подпись", can_supervise: "Согласование", can_acknowledge: "Ознакомление",
  can_create_gro: "Создание ГРО", can_edit_gro: "Редакт. ГРО", can_delete_gro: "Удаление ГРО",
  can_add_gro_files: "Файлы ГРО", can_change_gro_status: "Статус ГРО",
  can_create_requests: "Создание заявки", can_edit_requests: "Редакт. заявки", can_add_request_files: "Файлы заявки",
  can_delete_requests: "Удаление заявки", can_execute_requests: "Исполнение", can_change_request_status: "Статус заявки",
};

const ALL_PERM_KEYS: PermissionKey[] = Object.keys(PERM_LABELS) as PermissionKey[];

/* ──────────────── Главный компонент ──────────────── */

export default function StructurePage() {
  const { isPortalAdmin } = useAuth();
  const { isMobile } = useMobile();
  const [openRole, setOpenRole] = useState<ProjectRoleType | null>(null);
  const [section, setSection] = useState<"flows" | "roles" | "problems">("flows");

  if (!isPortalAdmin) return <Navigate to=".." replace />;

  return (
    <div className={`${isMobile ? "" : "max-w-6xl mx-auto"} space-y-8 pb-12`}>
      <div>
        <h1 className={`${isMobile ? "text-lg" : "text-2xl"} font-bold mb-1`} style={{ color: "var(--ds-text)" }}>Карта работы портала DocStroy</h1>
        <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
          Блок-схемы пользовательских сценариев, построенные по реальной логике кода
        </p>
        <div className={`flex gap-2 ${isMobile ? "overflow-x-auto pb-1" : ""}`}>
          {([["flows", "Сценарии"], ["roles", "Роли и доступ"], ["problems", "Проблемные места"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSection(k)} className={`${isMobile ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} rounded-lg font-medium transition-colors whitespace-nowrap`}
              style={section === k
                ? { background: "var(--ds-accent)", color: "#fff" }
                : { background: "var(--ds-surface-elevated)", color: "var(--ds-text-muted)", border: "1px solid var(--ds-border)" }
              }>{l}</button>
          ))}
        </div>
      </div>

      {section === "flows" && <FlowsSection />}
      {section === "roles" && <RolesSection openRole={openRole} setOpenRole={setOpenRole} />}
      {section === "problems" && <ProblemsSection />}
    </div>
  );
}

/* ═══════════════ СЕКЦИЯ: СЦЕНАРИИ ═══════════════ */

function FlowsSection() {
  return (
    <div className="space-y-10 overflow-x-auto">
      {/* Блок 1: Авторизация */}
      <section>
        <H2>1. Авторизация и вход</H2>
        <div className="flex flex-col items-center gap-1">
          <Box title="Пользователь открывает сайт" color="#3b82f6" />
          <Arr />
          <Diamond>Авторизован?</Diamond>
          <div className="flex gap-8 items-start mt-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium" style={{ color: "#22c55e" }}>Да</span>
              <Diamond>Токен валиден?</Diamond>
              <div className="flex gap-6 items-start mt-1">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: "#ef4444" }}>Нет</span>
                  <Box title="Авто-logout" warn>signOut(local) + редирект на /auth</Box>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: "#22c55e" }}>Да</span>
                </div>
              </div>
              <Arr />
              <Diamond>Нужна смена пароля?</Diamond>
              <div className="flex gap-6 items-start mt-1">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: "#ef4444" }}>Да</span>
                  <Box title="Модалка смены пароля" warn>Блокирует всё, пока не сменит</Box>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: "#22c55e" }}>Нет</span>
                  <Box title="Страница «Проекты»" color="#3b82f6">Список доступных проектов</Box>
                  <Arr />
                  <Diamond>Geo-режим?</Diamond>
                  <div className="flex gap-6 items-start mt-1">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs" style={{ color: "#f59e0b" }}>Да</span>
                      <Box title="Заявки" color="#f59e0b">Только заявки</Box>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs" style={{ color: "#3b82f6" }}>Нет</span>
                      <Box title="Реестр" color="#3b82f6">Полный доступ к разделам</Box>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium" style={{ color: "#ef4444" }}>Нет</span>
              <Box title="Страница входа" color="#8b5cf6">Вкладки: «Вход» / «Регистрация»</Box>
              <Arr />
              <Diamond>Верные данные?</Diamond>
              <div className="flex gap-6 items-start mt-1">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: "#22c55e" }}>Да</span>
                  <Box title="→ Проекты" color="#22c55e" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: "#ef4444" }}>Нет</span>
                  <Box title="Ошибка" warn>Сообщение под формой</Box>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Блок 2: Навигация */}
      <section>
        <H2>2. Рабочее пространство — навигация</H2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { title: "Основное", color: "#3b82f6", items: [
              { name: "Реестр", desc: "Таблица ячеек, фильтры, сортировка, пагинация, экспорт XLS" },
              { name: "ГРО", desc: "Геодезическая разбивочная основа — создание, файлы, статусы" },
              { name: "Проводник", desc: "Дерево файлов: корпус → вид работ → этаж → комплект" },
            ]},
            { title: "Планы", color: "#8b5cf6", items: [
              { name: "План", desc: "Подложки с полигонами ячеек, клик → детали ячейки" },
              { name: "Шахматка", desc: "Матрица: корпуса × виды работ, цвет = статус" },
              { name: "Фасады / Благоустройство", desc: "Аналог плана, фильтр по типу подложки" },
            ]},
            { title: "Коммуникации", color: "#10b981", items: [
              { name: "Заявки", desc: "Создание → исполнение → ознакомление; миниатюра подложки с маской в карточке" },
              { name: "Обмен файлами", desc: "Отправка файлов; кнопка «Отправить» в заголовке; подсказки валидации; привязка к конструкциям" },
              { name: "Задачи", desc: "Сводка: входящие ячейки + заявки + файлы; полноэкранный на мобильных" },
            ]},
            { title: "Управление", color: "#f59e0b", items: [
              { name: "Админ", desc: "Справочники, пользователи, роли, история действий" },
              { name: "Инструкция", desc: "Встроенная справка с возможностью скачать PDF" },
              { name: "Структура", desc: "Эта страница — карта системы (портальный админ)" },
            ]},
          ].map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: group.color }}>{group.title}</h3>
              <div className="space-y-2">
                {group.items.map((it) => <Box key={it.name} title={it.name} color={group.color}>{it.desc}</Box>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Блок 3: Жизненный цикл ячейки */}
      <section>
        <H2>3. Жизненный цикл ячейки</H2>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {DEFAULT_STATUS_NAMES.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border)", color: "var(--ds-text)" }}>{s}</span>
              {i < DEFAULT_STATUS_NAMES.length - 1 && (
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="var(--ds-text-faint)" strokeWidth="2">
                  <path d="M2 6h12M12 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <Box title="Исполнитель создаёт ячейку" color="#3b82f6">Заполняет поля + загружает файлы</Box>
          <Arr />
          <Box title="Отправляет на проверку" color="#3b82f6">Выбирает проверяющего из списка участников</Box>
          <Arr />
          <Diamond>Проверяющий решает</Diamond>
          <div className="flex gap-8 items-start mt-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs" style={{ color: "#22c55e" }}>Подписывает</span>
              <Box title="Ячейка подписана" color="#22c55e">Можно отправить на ознакомление или АН</Box>
              <Arr />
              <Box title="Статус меняет Администратор" color="#f59e0b">Только роль «Администратор» может менять статус</Box>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs" style={{ color: "#ef4444" }}>Замечание</span>
              <Box title="Возврат исполнителю" warn>Исполнитель исправляет и отправляет повторно</Box>
              <Arr label="Цикл" />
              <Box title="↑ Повторная отправка" color="#3b82f6" />
            </div>
          </div>
        </div>
      </section>

      {/* Блок 4: Заявки */}
      <section>
        <H2>4. Сценарий работы с заявками</H2>
        <div className="flex flex-col items-center gap-1">
          <Box title="Автор создаёт заявку" color="#3b82f6">Вид работ, корпус, этаж, описание, файлы</Box>
          <Arr />
          <Diamond>Назначен исполнитель?</Diamond>
          <div className="flex gap-8 items-start mt-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs" style={{ color: "#22c55e" }}>Да</span>
              <Box title="Исполнитель видит заявку" color="#10b981">В «Задачах» → вкладка «Заявки»</Box>
              <Arr />
              <Box title="Исполняет заявку" color="#10b981">Загружает результат, нажимает «Выполнить»</Box>
              <Arr />
              <Box title="Автор ознакамливается" color="#3b82f6">Видит результат, нажимает «Ознакомлен»</Box>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs" style={{ color: "#f59e0b" }}>Нет</span>
              <Box title="Заявка ждёт назначения" color="#f59e0b">Висит «В работе» без исполнителя</Box>
            </div>
          </div>
        </div>
      </section>

      {/* Блок 5: Обмен файлами */}
      <section>
        <H2>5. Обмен файлами</H2>
        <div className="flex flex-col items-center gap-1">
          <Box title="Отправитель создаёт обмен" color="#3b82f6">Файлы + получатели (обязательно); комментарий, привязка к конструкциям (необязательно)</Box>
          <Arr />
          <Box title="Подсказки валидации" color="#f59e0b">Под заголовком: «Укажите: Файлы / Получатели»; кнопка «Отправить» в заголовке</Box>
          <Arr />
          <Diamond>Черновик или отправка?</Diamond>
          <div className="flex gap-8 items-start mt-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs" style={{ color: "#3b82f6" }}>Отправить</span>
              <Box title="Получатели видят файлы" color="#10b981">Во «Входящих» с бейджем «новое»</Box>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs" style={{ color: "#f59e0b" }}>Черновик</span>
              <Box title="Сохранён как черновик" color="#f59e0b">Можно отредактировать и отправить позже</Box>
            </div>
          </div>
        </div>
      </section>

      {/* Блок 6: Мобильная адаптация */}
      <section>
        <H2>6. Мобильная адаптация</H2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Box title="Модалки" color="#8b5cf6">Карточка ячейки, карточка заявки — полноэкранные на мобильных (без скруглений)</Box>
          <Box title="Навигация" color="#8b5cf6">Боковое меню открывается кнопкой ☰; табы — горизонтальный скролл</Box>
          <Box title="Контент" color="#8b5cf6">Уменьшенные отступы; карточки вместо таблиц; адаптированные шрифты</Box>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════ СЕКЦИЯ: РОЛИ ═══════════════ */

function RolesSection({ openRole, setOpenRole }: { openRole: ProjectRoleType | null; setOpenRole: (r: ProjectRoleType | null) => void }) {
  return (
    <div className="space-y-10">
      <section>
        <H2>Иерархия проверки доступа</H2>
        <div className="flex flex-col items-center gap-1 mb-6">
          <Box title="Портальный админ?" color="#22c55e">Всегда ДА на всё</Box>
          <Arr label="Нет" />
          <Box title="Роль «Администратор»?" color="#22c55e">ДА на всё</Box>
          <Arr label="Нет" />
          <Box title="Роль «Администратор проекта»?" color="#3b82f6">ДА на всё, кроме смены статуса</Box>
          <Arr label="Нет" />
          <Box title="Индивидуальное разрешение" color="#8b5cf6">user_permissions — высший приоритет для обычных ролей</Box>
          <Arr label="Не задано" />
          <Box title="Разрешения заявок?" color="#f59e0b">Только если админ проекта включил явно → иначе НЕТ</Box>
          <Arr label="Не заявка" />
          <Box title="Портальные настройки роли" color="#06b6d4">portal_role_permissions — настраиваемый шаблон</Box>
          <Arr label="Не задано" />
          <Box title="Дефолт роли (в коде)">ROLE_DEFAULT_PERMISSIONS — последний fallback</Box>
        </div>
      </section>

      <section>
        <H2>Роли проекта ({PROJECT_ROLES.length})</H2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROJECT_ROLES.map((role) => {
            const perms = ROLE_DEFAULT_PERMISSIONS[role];
            const trueCount = Object.values(perms).filter(Boolean).length;
            const total = Object.keys(perms).length;
            const isOpen = openRole === role;
            return (
              <button key={role} onClick={() => setOpenRole(isOpen ? null : role)}
                className="w-full text-left rounded-lg p-3 transition-colors"
                style={{ background: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm" style={{ color: "var(--ds-text)" }}>{role}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--ds-accent)", color: "#fff" }}>{trueCount}/{total}</span>
                </div>
                {isOpen && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ALL_PERM_KEYS.map((k) => <Pill key={k} on={perms[k]} label={PERM_LABELS[k] || k} />)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--ds-text-faint)" }}>Нажмите на роль, чтобы увидеть все разрешения</p>
      </section>

      <section>
        <H2>Ключевые ограничения</H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Box title="Смена статуса ячейки" color="#ef4444">Только роль «Администратор». Даже «Администратор проекта» не может.</Box>
          <Box title="Доступ к заявкам" color="#ef4444">По умолчанию отключён для всех ролей. Админ проекта включает вручную.</Box>
          <Box title="Страница «Структура»" color="#f59e0b">Только портальный админ. Остальные — редирект назад.</Box>
          <Box title="Страница «Админ»" color="#f59e0b">Только админ проекта / портальный админ.</Box>
          <Box title="Geo-режим" color="#f59e0b">Скрывает все разделы, кроме заявок.</Box>
          <Box title="Читатель проекта" color="#3b82f6">Только просмотр. Ни одно действие не доступно.</Box>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════ СЕКЦИЯ: ПРОБЛЕМНЫЕ МЕСТА ═══════════════ */

function ProblemsSection() {
  return (
    <div className="space-y-10">
      <section>
        <H2>Где пользователь может «застрять»</H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WarnBox title="Обязательная смена пароля" items={[
            "Модалка блокирует ВСЕ действия — нельзя даже выйти",
            "Нет кнопки «Отмена» или «Выйти из системы»",
            "Если сервер не отвечает — пользователь заблокирован навсегда",
          ]} />
          <WarnBox title="Нет участников для отправки" items={[
            "Модалка «Отправить на проверку» показывает: «Нет участников»",
            "Не объясняет ПОЧЕМУ — нет нужной роли? Нет разрешения?",
            "Пользователь не может ничего сделать — только закрыть модалку",
          ]} />
          <WarnBox title="Заявка без исполнителя" items={[
            "Заявка создана, но никто не назначен",
            "Висит в статусе «В работе» бесконечно",
            "Автор не получает никаких уведомлений о проблеме",
          ]} />
          <WarnBox title="Проект без членства" items={[
            "Переход по прямой ссылке на чужой проект",
            "Ошибка 403 без объяснения кто может дать доступ",
            "Кнопка «К проектам» — единственный выход",
          ]} />
        </div>
      </section>

      <section>
        <H2>Кнопка видна — действие заблокировано</H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WarnBox title="Редактирование ячейки по статусу" items={[
            "Кнопка проверяет и разрешение, и статус ячейки",
            "Если статус не позволяет — кнопка скрыта без пояснения",
            "Нет сообщения «нельзя редактировать в этом статусе»",
          ]} />
          <WarnBox title="Действия с заявками" items={[
            "Разрешения заявок требуют ЯВНОГО включения админом",
            "Если не включено — кнопка создания просто отсутствует",
            "Пользователь не знает, что функция существует",
          ]} />
        </div>
      </section>

      <section>
        <H2>Ошибки API и тихие сбои</H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WarnBox title="Частичная загрузка файлов" items={[
            "Если часть файлов не загрузится — ошибка только в консоли",
            "Ячейка/заявка создаётся, но без части файлов",
            "Пользователь может не заметить пропажу",
          ]} />
          <WarnBox title="Залипание кнопки «Отправить»" items={[
            "В некоторых модалках: ошибка до setLoading(false)",
            "Кнопка остаётся disabled навсегда",
            "Выход — закрыть и открыть модалку заново",
          ]} />
          <WarnBox title="Потеря фильтров после действия" items={[
            "После создания/редактирования — данные перезагружаются",
            "Фильтры и пагинация сбрасываются",
            "Пользователь теряет позицию в списке",
          ]} />
          <WarnBox title="Обмен файлами: удаление получателей" items={[
            "При редактировании: старые получатели удаляются, новые вставляются",
            "Если удаление прошло, а вставка нет — обмен без получателей",
            "Данные потеряны без возможности восстановления",
          ]} />
        </div>
      </section>

      <section>
        <H2>Пустые состояния</H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Box title="Реестр: «Ничего не найдено»" color="#f59e0b">
            Одинаковое сообщение для пустого реестра и слишком строгого фильтра.
            Пользователь не понимает причину.
          </Box>
          <Box title="Задачи: пустые вкладки" color="#f59e0b">
            Нет входящих задач — вкладка пуста без пояснения.
            Непонятно: задач нет или ошибка загрузки?
          </Box>
          <Box title="План: нет подложек" color="#f59e0b">
            Админ не загрузил подложки — страница пуста.
            Нет инструкции, что делать.
          </Box>
          <Box title="Проводник: пустые папки" color="#f59e0b">
            Справочники загружены, но ячеек нет —
            дерево с пустыми папками без файлов.
          </Box>
        </div>
      </section>

      <section>
        <H2>Циклы и повторные действия</H2>
        <div className="flex flex-col items-center gap-1">
          <Box title="Цикл проверки ячейки" color="#f59e0b">
            Исполнитель → Проверяющий ставит замечание → Исполнитель исправляет → снова...
          </Box>
          <Arr label="Бесконечно" />
          <Box title="Нет лимита итераций" warn>
            Ячейка может «крутиться» между исполнителем и проверяющим без ограничений.
          </Box>
        </div>
        <div className="mt-4 flex flex-col items-center gap-1">
          <Box title="Кнопка «Повторить» при ошибке" color="#f59e0b">
            Вызывает тот же запрос без задержки.
          </Box>
          <Arr />
          <Box title="Нет ограничения попыток" warn>
            Если сервер стабильно ошибается — пользователь нажимает бесконечно.
          </Box>
        </div>
      </section>

      <section>
        <H2>Сводка рисков</H2>
        <div className="rounded-lg p-4" style={{ background: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border)" }}>
          <ol className="space-y-2 text-sm" style={{ color: "var(--ds-text)" }}>
            <li><strong>1.</strong> Частичный сбой загрузки файлов — пользователь не узнаёт о потере</li>
            <li><strong>2.</strong> Потеря контекста — фильтры и позиция сбрасываются после действий</li>
            <li><strong>3.</strong> Смена пароля без выхода — блокировка без возможности отмены</li>
            <li><strong>4.</strong> Тихие ошибки в обмене файлами — получатели могут пропасть</li>
            <li><strong>5.</strong> Неинформативные пустые состояния — одно сообщение на все случаи</li>
            <li><strong>6.</strong> Исчезающие кнопки — нет объяснения «у вас нет прав»</li>
            <li><strong>7.</strong> Бесконечный цикл проверки — нет лимита на замечание→исправление</li>
            <li><strong>8.</strong> Залипание загрузки — кнопка может остаться disabled при ошибке</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
