// Типы данных портала DocStroy

// ============================================
// Перечисления
// ============================================

export type Structure = 'Заказчик' | 'Строительный контроль' | 'Генподрядчик' | 'Подрядчик';

export type Position = 'Руководитель' | 'Инженер ПТО' | 'Геодезист' | 'Строительный контроль';

export type ProjectRoleType =
  | 'Администратор'
  | 'Администратор проекта'
  | 'Комментатор проекта'
  | 'Читатель проекта'
  | 'Исполнитель проекта'
  | 'Проверяющий проекта'
  | 'Исполнитель и Проверяющий проекта'
  | 'Авторский надзор'
  | 'Производитель работ';

export type CellStatus = string;

export type CellSendType = 'review' | 'acknowledge' | 'supervision';

export type SignatureStatus = 'На согласовании' | 'Подписано' | 'Отклонено' | 'Подписано с замечанием' | 'Ознакомлен' | 'Согласовано';

// ============================================
// Профиль пользователя
// ============================================

export interface Profile {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  email: string;
  phone: string | null;
  structure: Structure;
  organization: string;
  position: Position;
  is_portal_admin: boolean;
  is_global_reader: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Проекты
// ============================================

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  project_role: ProjectRoleType | null;
  organization_id: string | null;
  joined_at: string;
}

// ============================================
// Ячейки
// ============================================

export interface Cell {
  id: string;
  project_id: string;
  name: string;
  work_stage_id: string | null;
  building_id: string | null;
  floor_id: string | null;
  work_type_id: string | null;
  construction_id: string | null;
  set_id: string | null;
  description: string | null;
  tag: string | null;
  manual_tag: string | null;
  status: CellStatus;
  progress_percent: number | null;
  is_final_signed: boolean;
  assigned_to: string | null;
  assigned_by: string | null;
  original_sender_id: string | null;
  send_type: CellSendType | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CellFileCategory = 'general' | 'supervision_approval' | 'archive_scan';

export interface CellFile {
  id: string;
  cell_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  category: CellFileCategory;
}

export interface CellFileVersion {
  id: string;
  file_id: string;
  version_number: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  notes: string | null;
  uploaded_at: string;
}

// ============================================
// Подписи и история
// ============================================

export interface CellSignature {
  id: string;
  cell_id: string;
  user_id: string;
  status: SignatureStatus;
  comment: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface CellHistory {
  id: string;
  cell_id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface CellComment {
  id: string;
  cell_id: string;
  user_id: string;
  text: string | null;
  file_name: string | null;
  file_path: string | null;
  created_at: string;
}

export interface CellPublicComment {
  id: string;
  cell_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

// ============================================
// Разрешения (39 ключей для уровней 1/3)
// ============================================

export interface UserPermission {
  id: string;
  project_id: string;
  user_id: string;
  // Страница проекта
  can_view_tasks: boolean;
  can_view_requests: boolean;
  can_view_admin: boolean;
  can_print: boolean;
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

export type PermissionKey = keyof Omit<UserPermission, 'id' | 'project_id' | 'user_id'>;

// ============================================
// Статусы проекта
// ============================================

// ============================================
// Справочники
// ============================================

export interface DictionaryItem {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// ============================================
// Подложки (overlay images)
// ============================================

export interface Overlay {
  id: string;
  project_id: string;
  name: string;
  file_name: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  tab_type: 'plan' | 'facades' | 'landscaping' | null;
  created_at: string;
}

export interface CellOverlayMask {
  id: string;
  cell_id: string;
  overlay_id: string;
  polygon_points: { x: number; y: number }[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Сетки осей
// ============================================

export interface AxisGrid {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  axis_order: 'vh' | 'hv';
  created_at: string;
}

export type AxisDirection = 'vertical' | 'horizontal';

export interface AxisGridAxis {
  id: string;
  grid_id: string;
  direction: AxisDirection;
  name: string;
  sort_order: number;
  created_at: string;
}

// ============================================
// Связи справочников (каскадная фильтрация)
// ============================================

export interface DictLinkConfig {
  parentTable: string;
  childTable: string;
  linkTable: string;
  parentFk: string;
  childFk: string;
  parentLabel: string;
  childLabel: string;
}

export const DICT_LINK_CONFIGS: DictLinkConfig[] = [
  // [0] Место работ → Вид работ
  { parentTable: 'dict_buildings', childTable: 'dict_work_types', linkTable: 'dict_building_work_types', parentFk: 'building_id', childFk: 'work_type_id', parentLabel: 'Место работ', childLabel: 'Вид работ' },
  // [1] Вид работ → Конструкция
  { parentTable: 'dict_work_types', childTable: 'dict_constructions', linkTable: 'dict_work_type_constructions', parentFk: 'work_type_id', childFk: 'construction_id', parentLabel: 'Вид работ', childLabel: 'Конструкция' },
  // [2] DEPRECATED — replaced by dict_building_work_type_floors (triple link: building + work_type → floor)
  // Kept for index compatibility; not used in admin UI
  { parentTable: 'dict_work_types', childTable: 'dict_floors', linkTable: 'dict_work_type_floors', parentFk: 'work_type_id', childFk: 'floor_id', parentLabel: 'Вид работ', childLabel: 'Уровни/срезы' },
  // [3] Вид работ → Комплект
  { parentTable: 'dict_work_types', childTable: 'dict_sets', linkTable: 'dict_work_type_sets', parentFk: 'work_type_id', childFk: 'set_id', parentLabel: 'Вид работ', childLabel: 'Комплект' },
  // [4] Вид работ → Подложка
  { parentTable: 'dict_work_types', childTable: 'dict_overlays', linkTable: 'dict_work_type_overlays', parentFk: 'work_type_id', childFk: 'overlay_id', parentLabel: 'Вид работ', childLabel: 'Подложка' },
  // [5] Комплект → Вид работ (обратная связь, управляется из справочника «Комплект»)
  { parentTable: 'dict_sets', childTable: 'dict_work_types', linkTable: 'dict_work_type_sets', parentFk: 'set_id', childFk: 'work_type_id', parentLabel: 'Комплект', childLabel: 'Вид работ' },
  // [6] Подложка → Место работ
  { parentTable: 'dict_overlays', childTable: 'dict_buildings', linkTable: 'dict_overlay_buildings', parentFk: 'overlay_id', childFk: 'building_id', parentLabel: 'Подложка', childLabel: 'Место работ' },
  // [7] Подложка → Уровни/срезы
  { parentTable: 'dict_overlays', childTable: 'dict_floors', linkTable: 'dict_overlay_floors', parentFk: 'overlay_id', childFk: 'floor_id', parentLabel: 'Подложка', childLabel: 'Уровни/срезы' },
  // [8] Подложка → Конструкция
  { parentTable: 'dict_overlays', childTable: 'dict_constructions', linkTable: 'dict_overlay_constructions', parentFk: 'overlay_id', childFk: 'construction_id', parentLabel: 'Подложка', childLabel: 'Конструкция' },
  // [9] Подложка → Выполняемая работа
  { parentTable: 'dict_overlays', childTable: 'dict_works', linkTable: 'dict_overlay_works', parentFk: 'overlay_id', childFk: 'work_id', parentLabel: 'Подложка', childLabel: 'Выполняемая работа' },
];

// ============================================
// Динамические разрешения ячеек (роль × статус) — 9 действий × 4 роли
// ============================================

export type CellActionKey =
  | 'edit_info' | 'edit_mask' | 'edit_description'
  | 'add_update_files' | 'delete_files' | 'delete_cell'
  | 'sign_remark' | 'supervise'
  | 'attach_supervision' | 'attach_scan_archive';

export const CELL_ACTION_KEYS: CellActionKey[] = [
  'edit_info', 'edit_mask', 'edit_description',
  'add_update_files', 'delete_files', 'delete_cell',
  'sign_remark', 'supervise',
  'attach_supervision', 'attach_scan_archive',
];

export const CELL_ACTION_LABELS: Record<CellActionKey, string> = {
  edit_info: 'Редактирование информации',
  edit_mask: 'Редактирование масок',
  edit_description: 'Описание и метки',
  add_update_files: 'Добавление/обновление файлов',
  delete_files: 'Удаление файлов',
  delete_cell: 'Удаление ячейки',
  sign_remark: 'Подписать/замечания/переслать',
  supervise: 'Согласовать/на исправление',
  attach_supervision: 'Прикрепить согласование АН',
  attach_scan_archive: 'Прикрепить скан/в архив',
};

export const CELL_ROLE_CONTEXTS: string[] = [
  'Администратор проекта',
  '__cell_creator__',
  '__inbox_task__',
  '__others__',
];

export const CELL_ROLE_CONTEXT_LABELS: Record<string, string> = {
  'Администратор проекта': 'Администратор проекта',
  '__cell_creator__': 'Создатель ячейки',
  '__inbox_task__': 'Во входящих задачах',
  '__others__': 'Другие пользователи',
};

export interface CellActionPermission {
  id: string;
  project_id: string;
  role_context: string;
  status_name: string;
  edit_info: boolean;
  edit_mask: boolean;
  edit_description: boolean;
  add_update_files: boolean;
  delete_files: boolean;
  delete_cell: boolean;
  sign_remark: boolean;
  supervise: boolean;
  attach_supervision: boolean;
  attach_scan_archive: boolean;
}

// ============================================
// Константы для списков выбора
// ============================================

export const STRUCTURES: Structure[] = [
  'Заказчик',
  'Строительный контроль',
  'Генподрядчик',
  'Подрядчик',
];

export const POSITIONS: Position[] = [
  'Руководитель',
  'Инженер ПТО',
  'Геодезист',
  'Строительный контроль',
];

export const PROJECT_ROLES: ProjectRoleType[] = [
  'Администратор',
  'Администратор проекта',
  'Исполнитель проекта',
  'Проверяющий проекта',
  'Исполнитель и Проверяющий проекта',
  'Комментатор проекта',
  'Читатель проекта',
  'Авторский надзор',
  'Производитель работ',
];

/** Именованные константы для ролей — используйте вместо строковых литералов */
export const ROLES = {
  ADMIN: 'Администратор',
  PROJECT_ADMIN: 'Администратор проекта',
  EXECUTOR: 'Исполнитель проекта',
  REVIEWER: 'Проверяющий проекта',
  EXECUTOR_REVIEWER: 'Исполнитель и Проверяющий проекта',
  COMMENTER: 'Комментатор проекта',
  READER: 'Читатель проекта',
  SUPERVISION: 'Авторский надзор',
  WORK_PRODUCER: 'Производитель работ',
} as const satisfies Record<string, ProjectRoleType>;

/** Дефолтные статусы (для reference, загружаются из БД) */
export const DEFAULT_STATUS_NAMES = [
  'Новый', 'На проверке', 'Замечания',
  'Подписано', 'Подписано с замечанием',
  'Окончательно утверждён',
] as const;

// Дефолтные разрешения по ролям (39 ключей)
const ALL_FALSE_PERMS: Record<PermissionKey, boolean> = {
  can_view_tasks: false, can_view_requests: false, can_view_admin: false, can_print: false,
  can_view_cell: false, can_view_files_block: false, can_view_remarks_block: false,
  can_view_supervision_block: false, can_view_scan_block: false, can_view_process_block: false,
  can_view_comments_block: false, can_preview_files: false,
  can_create_cells: false, can_edit_cell: false, can_delete_cell: false, can_edit_mask: false,
  can_add_update_files: false, can_add_update_supervision: false, can_add_update_scan: false,
  can_add_comments: false, can_send_cells: false, can_archive: false,
  can_download_files: false, can_change_status: false,
  can_remark: false, can_sign: false, can_supervise: false, can_acknowledge: false,
  can_create_gro: false, can_edit_gro: false, can_delete_gro: false,
  can_add_gro_files: false, can_change_gro_status: false,
  can_create_requests: false, can_edit_requests: false, can_add_request_files: false,
  can_delete_requests: false, can_execute_requests: false, can_change_request_status: false,
};

/** Базовые разрешения просмотра (для всех ролей) */
const VIEW_PERMS: Partial<Record<PermissionKey, boolean>> = {
  can_view_tasks: true, can_view_cell: true, can_view_files_block: true,
  can_view_remarks_block: true, can_view_supervision_block: true, can_view_scan_block: true,
  can_view_process_block: true, can_view_comments_block: true,
  can_preview_files: true, can_download_files: true, can_print: true,
};

export const ROLE_DEFAULT_PERMISSIONS: Record<ProjectRoleType, Record<PermissionKey, boolean>> = {
  'Администратор': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_view_admin: true, can_view_requests: true,
    can_create_cells: true, can_edit_cell: true, can_delete_cell: true, can_edit_mask: true,
    can_add_update_files: true, can_add_update_supervision: true, can_add_update_scan: true,
    can_add_comments: true, can_send_cells: true, can_archive: true, can_change_status: true,
    can_remark: true, can_sign: true, can_supervise: true, can_acknowledge: true,
    can_create_gro: true, can_edit_gro: true, can_delete_gro: true,
    can_add_gro_files: true, can_change_gro_status: true,
    can_create_requests: true, can_edit_requests: true, can_add_request_files: true,
    can_delete_requests: true, can_execute_requests: true, can_change_request_status: true,
  },
  'Администратор проекта': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_view_admin: true, can_view_requests: true,
    can_create_cells: true, can_edit_cell: true, can_delete_cell: true, can_edit_mask: true,
    can_add_update_files: true, can_add_update_supervision: true, can_add_update_scan: true,
    can_add_comments: true, can_send_cells: true, can_archive: true,
    can_remark: true, can_sign: true, can_supervise: true, can_acknowledge: true,
    can_create_gro: true, can_edit_gro: true, can_delete_gro: true,
    can_add_gro_files: true,
    can_create_requests: true, can_edit_requests: true, can_add_request_files: true,
    can_delete_requests: true, can_execute_requests: true,
  },
  'Исполнитель проекта': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_create_cells: true, can_edit_cell: true, can_edit_mask: true,
    can_add_update_files: true, can_add_update_supervision: true, can_add_update_scan: true,
    can_add_comments: true, can_send_cells: true, can_archive: true,
    can_create_gro: true, can_edit_gro: true, can_add_gro_files: true,
    // request permissions OFF by default — project admin enables individually
  },
  'Проверяющий проекта': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_sign: true, can_remark: true, can_acknowledge: true,
    can_add_comments: true,
  },
  'Исполнитель и Проверяющий проекта': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_create_cells: true, can_edit_cell: true, can_edit_mask: true,
    can_add_update_files: true, can_add_update_supervision: true, can_add_update_scan: true,
    can_add_comments: true, can_send_cells: true, can_archive: true,
    can_sign: true, can_remark: true, can_acknowledge: true,
    can_create_gro: true, can_edit_gro: true, can_add_gro_files: true,
  },
  'Комментатор проекта': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_add_comments: true, can_acknowledge: true,
  },
  'Читатель проекта': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
  },
  'Авторский надзор': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_supervise: true, can_add_update_supervision: true,
    can_add_comments: true,
  },
  'Производитель работ': {
    ...ALL_FALSE_PERMS, ...VIEW_PERMS,
    can_add_comments: true, can_acknowledge: true,
    // request permissions OFF by default — project admin enables individually
  },
};

/** Дефолтные разрешения для пользователей без назначенной роли */
export const NO_ROLE_DEFAULT_PERMISSIONS: Record<PermissionKey, boolean> = {
  ...ALL_FALSE_PERMS, ...VIEW_PERMS,
};

// ============================================
// Мессенджер
// ============================================

export interface Chat {
  id: string;
  project_id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string | null;
  created_at: string;
}

export interface ChatMessageFile {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ChatFolder {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface ChatFolderItem {
  id: string;
  folder_id: string;
  chat_id: string;
  user_id: string;
}

