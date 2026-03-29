import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { DictionaryItem, DictLinkConfig } from "@/types";
import { DICT_LINK_CONFIGS } from "@/types";
import StatusManager from "./StatusManager";
import DictionaryLinkEditor from "./DictionaryLinkEditor";
import BuildingFloorLinkEditor from "./BuildingFloorLinkEditor";
import OverlayManager from "./OverlayManager";
import AxisGridManager from "./AxisGridManager";
import ZoneWorkTypeManager from "./ZoneWorkTypeManager";

interface DictionaryConfig {
  name: string;
  table: string;
  linkConfigs?: DictLinkConfig[];
  /** Показывать иконку управления уровнями (трёхсторонняя связь building+work_type→floors) */
  hasFloorLink?: boolean;
}

const DICTIONARIES: DictionaryConfig[] = [
  { name: "Выполняемая работа", table: "dict_works" },
  { name: "Место работ", table: "dict_buildings", linkConfigs: [DICT_LINK_CONFIGS[0]], hasFloorLink: true },
  { name: "Вид работ", table: "dict_work_types", linkConfigs: [DICT_LINK_CONFIGS[1], DICT_LINK_CONFIGS[3]] },
  { name: "Уровни/срезы", table: "dict_floors" },
  { name: "Конструкция", table: "dict_constructions" },
  { name: "Комплект", table: "dict_sets", linkConfigs: [DICT_LINK_CONFIGS[5]] },
  { name: "Компания", table: "project_organizations" },
];

export default function DictionaryManager() {
  const { isPortalAdmin } = useProject();
  const [activeDict, setActiveDict] = useState<DictionaryConfig | null>(null);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showOverlays, setShowOverlays] = useState(false);
  const [showAxisGrids, setShowAxisGrids] = useState(false);
  const [showZones, setShowZones] = useState(false);

  if (showStatuses) {
    return <StatusManager onBack={() => setShowStatuses(false)} />;
  }

  if (showOverlays) {
    return <OverlayManager onBack={() => setShowOverlays(false)} />;
  }

  if (showAxisGrids) {
    return <AxisGridManager onBack={() => setShowAxisGrids(false)} />;
  }

  if (showZones) {
    return <ZoneWorkTypeManager onBack={() => setShowZones(false)} />;
  }


  if (activeDict) {
    return (
      <DictionaryEditor
        config={activeDict}
        onBack={() => setActiveDict(null)}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Карточка статусов */}
      <button
        onClick={() => setShowStatuses(true)}
        className="ds-card p-5 text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium" style={{ color: "var(--ds-text)" }}>Статусы</h3>
          <svg className="w-4 h-4 transition-colors" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Статусы ячеек, цвета и роли</p>
      </button>

      {/* Карточка подложек */}
      <button
        onClick={() => setShowOverlays(true)}
        className="ds-card p-5 text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium" style={{ color: "var(--ds-text)" }}>Подложки</h3>
          <svg className="w-4 h-4 transition-colors" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Изображения планов и чертежей</p>
      </button>

      {/* Карточка сеток осей — только для портального администратора */}
      {isPortalAdmin && (
        <button
          onClick={() => setShowAxisGrids(true)}
          className="ds-card p-5 text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium" style={{ color: "var(--ds-text)" }}>Сетки осей</h3>
            <svg className="w-4 h-4 transition-colors" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Осевые сетки для подложек</p>
        </button>
      )}

      {/* Карточка зон строительства */}
      <button
        onClick={() => setShowZones(true)}
        className="ds-card p-5 text-left group cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium" style={{ color: "var(--ds-text)" }}>Зоны строительства</h3>
          <svg className="w-4 h-4 transition-colors" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Виды работ для шахматки зон</p>
      </button>

      {DICTIONARIES.map((dict) => (
        <button
          key={dict.table}
          onClick={() => setActiveDict(dict)}
          className="ds-card p-5 text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium" style={{ color: "var(--ds-text)" }}>{dict.name}</h3>
            <svg className="w-4 h-4 transition-colors" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Управление значениями справочника</p>
        </button>
      ))}
    </div>
  );
}

/** Маппинг: таблица справочника → FK-колонка в cells */
const CELLS_FK_MAP: Record<string, string> = {
  dict_buildings: "building_id",
  dict_work_types: "work_type_id",
  dict_floors: "floor_id",
  dict_constructions: "construction_id",
  dict_sets: "set_id",
  dict_works: "work_id",
};

/** Маппинг: таблица справочника → связующие таблицы, которые ссылаются на неё */
const LINK_TABLES_MAP: Record<string, { table: string; column: string }[]> = {
  dict_buildings: [
    { table: "dict_building_work_types", column: "building_id" },
    { table: "dict_building_work_type_floors", column: "building_id" },
    { table: "dict_overlay_buildings", column: "building_id" },
  ],
  dict_work_types: [
    { table: "dict_building_work_types", column: "work_type_id" },
    { table: "dict_building_work_type_floors", column: "work_type_id" },
    { table: "dict_work_type_constructions", column: "work_type_id" },
    { table: "dict_work_type_sets", column: "work_type_id" },
    { table: "dict_work_type_overlays", column: "work_type_id" },
    { table: "dict_zone_work_types", column: "work_type_id" },
  ],
  dict_floors: [
    { table: "dict_building_work_type_floors", column: "floor_id" },
    { table: "dict_overlay_floors", column: "floor_id" },
  ],
  dict_constructions: [
    { table: "dict_work_type_constructions", column: "construction_id" },
    { table: "dict_overlay_constructions", column: "construction_id" },
  ],
  dict_sets: [
    { table: "dict_work_type_sets", column: "set_id" },
  ],
  dict_works: [
    { table: "dict_overlay_works", column: "work_id" },
  ],
};

function DictionaryEditor({ config, onBack }: { config: DictionaryConfig; onBack: () => void }) {
  const { project } = useProject();
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [linkingItem, setLinkingItem] = useState<DictionaryItem | null>(null);
  const [linkingConfig, setLinkingConfig] = useState<DictLinkConfig | null>(null);
  const [linkedItemIds, setLinkedItemIds] = useState<Record<number, Set<string>>>({});
  const [floorLinkItem, setFloorLinkItem] = useState<DictionaryItem | null>(null);
  const [floorLinkedIds, setFloorLinkedIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    loadItems();
  }, [config.table, project]);

  async function loadItems() {
    if (!project) return;
    const { data } = await supabase
      .from(config.table)
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (data) setItems(data);
    setLoading(false);
    loadLinkStatus();
    if (config.hasFloorLink) loadFloorLinkStatus();
  }

  async function loadLinkStatus() {
    if (!config.linkConfigs || config.linkConfigs.length === 0) return;
    const result: Record<number, Set<string>> = {};
    await Promise.all(config.linkConfigs.map(async (lc, idx) => {
      const { data } = await supabase
        .from(lc.linkTable)
        .select(lc.parentFk);
      const ids = new Set<string>();
      if (data) {
        for (const row of data) {
          ids.add((row as unknown as Record<string, string>)[lc.parentFk]);
        }
      }
      result[idx] = ids;
    }));
    setLinkedItemIds(result);
  }

  async function loadFloorLinkStatus() {
    const { data } = await supabase
      .from("dict_building_work_type_floors")
      .select("building_id");
    const ids = new Set<string>();
    if (data) {
      for (const row of data) ids.add((row as any).building_id);
    }
    setFloorLinkedIds(ids);
  }

  async function addItem() {
    if (!project || !newName.trim()) return;
    const { error } = await supabase.from(config.table).insert({
      project_id: project.id,
      name: newName.trim(),
      sort_order: items.length,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewName("");
    loadItems();
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    await supabase.from(config.table).update({ name: editName.trim() }).eq("id", id);
    setEditingId(null);
    loadItems();
  }

  async function handleDrop(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setItems(reordered);
    const updates = reordered.map((item, i) =>
      supabase.from(config.table).update({ sort_order: i }).eq("id", item.id)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("Ошибка сохранения порядка:", failed.error);
      loadItems();
    }
  }

  async function deleteItem(id: string, name: string) {
    // Подсчёт затронутых ячеек
    const cellsFk = CELLS_FK_MAP[config.table];
    let cellCount = 0;
    if (cellsFk) {
      const { count } = await supabase
        .from("cells")
        .select("id", { count: "exact", head: true })
        .eq(cellsFk, id);
      cellCount = count || 0;
    }

    // Подсчёт затронутых связей
    const linkTables = LINK_TABLES_MAP[config.table] || [];
    let linkCount = 0;
    await Promise.all(linkTables.map(async (lt) => {
      const { count } = await supabase
        .from(lt.table)
        .select("id", { count: "exact", head: true })
        .eq(lt.column, id);
      linkCount += count || 0;
    }));

    // Формируем предупреждение
    let msg = `Удалить «${name}»?\n`;
    if (cellCount > 0 || linkCount > 0) {
      msg += "\n--- ВНИМАНИЕ! Это действие необратимо ---\n";
      if (cellCount > 0) {
        msg += `\n${cellCount} яч./заявок потеряют привязку к «${name}» (поле станет пустым)`;
      }
      if (linkCount > 0) {
        msg += `\n${linkCount} связей в настройках справочников будут удалены`;
      }
      msg += "\n\nВосстановить данные после удаления невозможно.";
      msg += "\nНовый элемент с тем же именем НЕ восстановит утраченные связи.";
    }

    if (!confirm(msg)) return;
    const { error } = await supabase.from(config.table).delete().eq("id", id);
    if (error) {
      alert("Ошибка удаления: " + error.message);
      return;
    }
    loadItems();
  }

  if (floorLinkItem) {
    return (
      <BuildingFloorLinkEditor
        building={floorLinkItem}
        onBack={() => { setFloorLinkItem(null); loadFloorLinkStatus(); }}
      />
    );
  }

  if (linkingItem && linkingConfig) {
    return (
      <DictionaryLinkEditor
        parentItem={linkingItem}
        linkConfig={linkingConfig}
        onBack={() => { setLinkingItem(null); setLinkingConfig(null); loadLinkStatus(); }}
      />
    );
  }

  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button
          onClick={onBack}
          className="ds-icon-btn"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{config.name}</h3>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>({items.length})</span>
        <div className="ml-auto flex items-center gap-1">
          {(deleteMode || reorderMode) ? (
            <button
              onClick={() => { setDeleteMode(false); setReorderMode(false); }}
              className="ds-btn-secondary !px-3 !py-1 text-xs"
            >
              Готово
            </button>
          ) : (
            <>
              <button
                onClick={() => { setReorderMode(true); setDeleteMode(false); }}
                className="ds-icon-btn !p-1.5 transition-colors"
                style={{ color: "var(--ds-text-muted)" }}
                title="Режим перемещения"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
              <button
                onClick={() => { setDeleteMode(true); setReorderMode(false); }}
                className="ds-icon-btn !p-1.5 transition-colors hover:!text-red-500"
                style={{ color: "var(--ds-text-muted)" }}
                title="Режим удаления"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Добавление */}
      <div className="flex gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Новое значение..."
          className="ds-input flex-1"
        />
        <button
          onClick={addItem}
          disabled={!newName.trim()}
          className="ds-btn"
        >
          Добавить
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Справочник пуст. Добавьте первое значение.
        </div>
      ) : (
        <ul>
          {items.map((item, idx) => (
            <li
              key={item.id}
              className={`flex items-center gap-2 px-4 py-2.5 group transition-colors ${reorderMode ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                borderBottom: idx < items.length - 1 ? "1px solid var(--ds-border)" : "none",
                ...(dropTarget === idx && dragIndex !== null && dragIndex !== idx
                  ? { borderTop: "2px solid var(--ds-accent)" }
                  : {}),
                ...(dragIndex === idx ? { opacity: 0.4 } : {}),
              }}
              draggable={reorderMode && editingId !== item.id}
              onDragStart={(e) => {
                if (!reorderMode) return;
                setDragIndex(idx);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!reorderMode || dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTarget(idx);
              }}
              onDragLeave={() => {
                if (dropTarget === idx) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== idx) {
                  handleDrop(dragIndex, idx);
                }
                setDragIndex(null);
                setDropTarget(null);
              }}
              onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
              onMouseEnter={(e) => { if (!reorderMode) e.currentTarget.style.background = "var(--ds-surface-sunken)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {reorderMode ? (
                <span className="w-5 flex justify-center shrink-0" style={{ color: "var(--ds-text-faint)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </span>
              ) : (
                <span className="w-5 text-xs text-center tabular-nums shrink-0" style={{ color: "var(--ds-text-faint)" }}>
                  {idx + 1}
                </span>
              )}

              {editingId === item.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                    className="ds-input flex-1 !py-1"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(item.id)}
                    className="ds-btn !px-2 !py-1 text-xs"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="ds-btn-secondary !px-2 !py-1 text-xs"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="flex-1 text-sm cursor-pointer select-none rounded px-1 -mx-1 transition-colors"
                    style={{ color: "var(--ds-text)" }}
                    onDoubleClick={() => { setEditingId(item.id); setEditName(item.name); }}
                    title="Двойной клик для редактирования"
                  >
                    {item.name}
                  </span>
                  {config.linkConfigs?.map((lc, lcIdx) => {
                    const hasLinks = linkedItemIds[lcIdx]?.has(item.id) || false;
                    return (
                      <button
                        key={lcIdx}
                        onClick={() => { setLinkingItem(item); setLinkingConfig(lc); }}
                        className="ds-icon-btn relative !p-1"
                        style={hasLinks ? { color: "var(--ds-text-muted)" } : { color: "var(--ds-text-faint)" }}
                        title={`Связи с ${lc.childLabel.toLowerCase()}${hasLinks ? " (установлена)" : ""}`}
                      >
                        {hasLinks && (
                          <span className="absolute inset-[-2px] rounded-full border-2 border-green-500 pointer-events-none" />
                        )}
                        <LinkIcon childTable={lc.childTable} />
                      </button>
                    );
                  })}
                  {config.hasFloorLink && (
                    <button
                      onClick={() => setFloorLinkItem(item)}
                      className="ds-icon-btn relative !p-1"
                      style={floorLinkedIds.has(item.id) ? { color: "var(--ds-text-muted)" } : { color: "var(--ds-text-faint)" }}
                      title={`Уровни/срезы${floorLinkedIds.has(item.id) ? " (установлена)" : ""}`}
                    >
                      {floorLinkedIds.has(item.id) && (
                        <span className="absolute inset-[-2px] rounded-full border-2 border-green-500 pointer-events-none" />
                      )}
                      <LinkIcon childTable="dict_floors" />
                    </button>
                  )}
                  {deleteMode && (
                    <button
                      onClick={() => deleteItem(item.id, item.name)}
                      className="ds-icon-btn !p-1 transition-colors hover:!text-red-500"
                      style={{ color: "#ef4444" }}
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkIcon({ childTable }: { childTable: string }) {
  const cls = "w-4 h-4";
  switch (childTable) {
    case "dict_work_types":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "dict_constructions":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "dict_floors":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case "dict_sets":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
  }
}
