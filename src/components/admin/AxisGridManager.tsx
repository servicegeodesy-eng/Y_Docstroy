import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { AxisGrid, AxisGridAxis, AxisDirection } from "@/types";

interface Props {
  onBack: () => void;
}

export default function AxisGridManager({ onBack }: Props) {
  const { project } = useProject();
  const [grids, setGrids] = useState<AxisGrid[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingGrid, setEditingGrid] = useState<AxisGrid | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    loadGrids();
  }, [project]);

  async function loadGrids() {
    if (!project) return;
    const { data } = await supabase
      .from("dict_axis_grids")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order")
      .order("name");
    if (data) setGrids(data);
    setLoading(false);
  }

  async function addGrid() {
    if (!project || !newName.trim()) return;
    await supabase.from("dict_axis_grids").insert({
      project_id: project.id,
      name: newName.trim(),
      sort_order: grids.length,
    });
    setNewName("");
    loadGrids();
  }

  async function deleteGrid(grid: AxisGrid) {
    const { count: linkCount } = await supabase
      .from("dict_overlay_axis_grids")
      .select("id", { count: "exact", head: true })
      .eq("grid_id", grid.id);

    let msg = `Удалить сетку «${grid.name}»?`;
    if (linkCount && linkCount > 0) {
      msg += `\n\n${linkCount} связей с подложками будут удалены.`;
    }
    if (!confirm(msg)) return;

    await supabase.from("dict_axis_grids").delete().eq("id", grid.id);
    loadGrids();
  }

  if (editingGrid) {
    return (
      <AxisGridEditor
        grid={editingGrid}
        onBack={() => { setEditingGrid(null); loadGrids(); }}
      />
    );
  }

  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>Сетки осей</h3>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>({grids.length})</span>
        <div className="ml-auto">
          {deleteMode ? (
            <button onClick={() => setDeleteMode(false)} className="ds-btn-secondary !px-3 !py-1 text-xs">Готово</button>
          ) : (
            <button
              onClick={() => setDeleteMode(true)}
              className="ds-icon-btn !p-1.5 transition-colors hover:!text-red-500"
              style={{ color: "var(--ds-text-muted)" }}
              title="Режим удаления"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGrid()}
          placeholder="Название сетки..."
          className="ds-input flex-1"
        />
        <button onClick={addGrid} disabled={!newName.trim()} className="ds-btn">Добавить</button>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : grids.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Сетки осей не созданы. Добавьте первую сетку.
        </div>
      ) : (
        <ul>
          {grids.map((grid, idx) => (
            <li
              key={grid.id}
              className="flex items-center gap-2 px-4 py-2.5 group"
              style={{ borderBottom: idx < grids.length - 1 ? "1px solid var(--ds-border)" : "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ds-surface-sunken)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span className="w-5 text-xs text-center tabular-nums shrink-0" style={{ color: "var(--ds-text-faint)" }}>
                {idx + 1}
              </span>
              <span
                className="flex-1 text-sm cursor-pointer select-none"
                style={{ color: "var(--ds-text)" }}
                onClick={() => setEditingGrid(grid)}
                title="Нажмите для редактирования осей"
              >
                {grid.name}
              </span>
              <button
                onClick={() => setEditingGrid(grid)}
                className="ds-icon-btn !p-1"
                style={{ color: "var(--ds-text-muted)" }}
                title="Редактировать оси"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              {deleteMode && (
                <button
                  onClick={() => deleteGrid(grid)}
                  className="ds-icon-btn !p-1 transition-colors hover:!text-red-500"
                  style={{ color: "#ef4444" }}
                  title="Удалить"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Редактор осей внутри одной сетки */
function AxisGridEditor({ grid, onBack }: { grid: AxisGrid; onBack: () => void }) {
  const [axes, setAxes] = useState<AxisGridAxis[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVertical, setNewVertical] = useState("");
  const [newHorizontal, setNewHorizontal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [gridName, setGridName] = useState(grid.name);
  const [editingGridName, setEditingGridName] = useState(false);
  const [axisOrder, setAxisOrder] = useState<'vh' | 'hv'>(grid.axis_order || 'vh');
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    loadAxes();
  }, [grid.id]);

  async function loadAxes() {
    const { data } = await supabase
      .from("dict_axis_grid_axes")
      .select("*")
      .eq("grid_id", grid.id)
      .order("sort_order")
      .order("name");
    if (data) setAxes(data);
    setLoading(false);
  }

  async function addAxis(direction: AxisDirection, name: string) {
    if (!name.trim()) return;
    const existing = axes.filter((a) => a.direction === direction);
    await supabase.from("dict_axis_grid_axes").insert({
      grid_id: grid.id,
      direction,
      name: name.trim(),
      sort_order: existing.length,
    });
    if (direction === "vertical") setNewVertical("");
    else setNewHorizontal("");
    loadAxes();
  }

  async function deleteAxis(id: string) {
    if (!confirm("Удалить ось?")) return;
    await supabase.from("dict_axis_grid_axes").delete().eq("id", id);
    loadAxes();
  }

  async function saveAxisName(id: string) {
    if (!editName.trim()) return;
    await supabase.from("dict_axis_grid_axes").update({ name: editName.trim() }).eq("id", id);
    setEditingId(null);
    loadAxes();
  }

  async function saveGridName() {
    if (!gridName.trim()) return;
    await supabase.from("dict_axis_grids").update({ name: gridName.trim() }).eq("id", grid.id);
    setEditingGridName(false);
  }

  async function toggleAxisOrder() {
    const newOrder = axisOrder === 'vh' ? 'hv' : 'vh';
    await supabase.from("dict_axis_grids").update({ axis_order: newOrder }).eq("id", grid.id);
    setAxisOrder(newOrder);
  }


  async function autoSortByName(direction: AxisDirection) {
    const dirAxes = axes
      .filter((a) => a.direction === direction)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const newAxes = axes.map((a) => {
      if (a.direction !== direction) return a;
      const idx = dirAxes.findIndex((d) => d.id === a.id);
      return { ...a, sort_order: idx };
    });
    setAxes(newAxes);
    await Promise.all(dirAxes.map((item, i) =>
      supabase.from("dict_axis_grid_axes").update({ sort_order: i }).eq("id", item.id)
    ));
  }

  async function handleDrop(direction: AxisDirection, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const dirAxes = axes
      .filter((a) => a.direction === direction)
      .sort((a, b) => a.sort_order - b.sort_order);
    const reordered = [...dirAxes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Обновляем локально сразу для отзывчивости
    const newAxes = axes.map((a) => {
      if (a.direction !== direction) return a;
      const idx = reordered.findIndex((r) => r.id === a.id);
      return idx >= 0 ? { ...a, sort_order: idx } : a;
    });
    setAxes(newAxes);
    // Сохраняем в БД
    await Promise.all(reordered.map((item, i) =>
      supabase.from("dict_axis_grid_axes").update({ sort_order: i }).eq("id", item.id)
    ));
  }

  const verticalAxes = axes.filter((a) => a.direction === "vertical").sort((a, b) => a.sort_order - b.sort_order);
  const horizontalAxes = axes.filter((a) => a.direction === "horizontal").sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {editingGridName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={gridName}
              onChange={(e) => setGridName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveGridName()}
              className="ds-input flex-1 !py-1"
              autoFocus
            />
            <button onClick={saveGridName} className="ds-btn !px-2 !py-1 text-xs">OK</button>
            <button onClick={() => { setEditingGridName(false); setGridName(grid.name); }} className="ds-btn-secondary !px-2 !py-1 text-xs">Отмена</button>
          </div>
        ) : (
          <h3
            className="text-sm font-medium cursor-pointer flex-1"
            style={{ color: "var(--ds-text)" }}
            onDoubleClick={() => setEditingGridName(true)}
            title="Двойной клик для переименования"
          >
            {gridName}
          </h3>
        )}
        {!editingGridName && axes.length > 0 && (
          <>
            {reorderMode ? (
              <button onClick={() => setReorderMode(false)} className="ds-btn-secondary !px-3 !py-1 text-xs">Готово</button>
            ) : (
              <button
                onClick={() => setReorderMode(true)}
                className="ds-icon-btn !p-1.5 transition-colors"
                style={{ color: "var(--ds-text-muted)" }}
                title="Режим сортировки"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            )}
            {!reorderMode && (
              <button
                onClick={toggleAxisOrder}
                className="px-2 py-0.5 rounded text-[11px] font-medium border transition-colors"
                style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}
                title={`Порядок в описании: ${axisOrder === 'vh' ? 'верт./гориз.' : 'гориз./верт.'} — нажмите для смены`}
              >
                {axisOrder === 'vh' ? 'В/Г' : 'Г/В'}
              </button>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : (
        <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--ds-border)" }}>
          {/* Вертикальные оси */}
          <div>
            <div className="flex items-center justify-between px-4 py-2 text-xs font-medium" style={{ color: "var(--ds-text-muted)", borderBottom: "1px solid var(--ds-border)" }}>
              <span>Вертикальные оси (столбцы) — {verticalAxes.length}</span>
              {verticalAxes.length > 1 && (
                <button onClick={() => autoSortByName("vertical")} className="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
                  style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-faint)" }} title="Автосортировка по названию">А→Я</button>
              )}
            </div>
            <div className="flex gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
              <input
                type="text"
                value={newVertical}
                onChange={(e) => setNewVertical(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAxis("vertical", newVertical)}
                placeholder="А, Б, В..."
                className="ds-input flex-1 !py-1 text-sm"
              />
              <button onClick={() => addAxis("vertical", newVertical)} disabled={!newVertical.trim()} className="ds-btn !px-2 !py-1 text-xs">+</button>
            </div>
            <AxisList
              axes={verticalAxes}
              editingId={editingId}
              editName={editName}
              reorderMode={reorderMode}
              onStartEdit={(a) => { setEditingId(a.id); setEditName(a.name); }}
              onSave={saveAxisName}
              onCancelEdit={() => setEditingId(null)}
              onDelete={deleteAxis}
              onDrop={(from, to) => handleDrop("vertical", from, to)}
              setEditName={setEditName}
            />
          </div>

          {/* Горизонтальные оси */}
          <div>
            <div className="flex items-center justify-between px-4 py-2 text-xs font-medium" style={{ color: "var(--ds-text-muted)", borderBottom: "1px solid var(--ds-border)" }}>
              <span>Горизонтальные оси (строки) — {horizontalAxes.length}</span>
              {horizontalAxes.length > 1 && (
                <button onClick={() => autoSortByName("horizontal")} className="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
                  style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-faint)" }} title="Автосортировка по названию">А→Я</button>
              )}
            </div>
            <div className="flex gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
              <input
                type="text"
                value={newHorizontal}
                onChange={(e) => setNewHorizontal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAxis("horizontal", newHorizontal)}
                placeholder="1, 2, 3..."
                className="ds-input flex-1 !py-1 text-sm"
              />
              <button onClick={() => addAxis("horizontal", newHorizontal)} disabled={!newHorizontal.trim()} className="ds-btn !px-2 !py-1 text-xs">+</button>
            </div>
            <AxisList
              axes={horizontalAxes}
              editingId={editingId}
              editName={editName}
              reorderMode={reorderMode}
              onStartEdit={(a) => { setEditingId(a.id); setEditName(a.name); }}
              onSave={saveAxisName}
              onCancelEdit={() => setEditingId(null)}
              onDelete={deleteAxis}
              onDrop={(from, to) => handleDrop("horizontal", from, to)}
              setEditName={setEditName}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AxisList({
  axes, editingId, editName, reorderMode,
  onStartEdit, onSave, onCancelEdit, onDelete, onDrop, setEditName,
}: {
  axes: AxisGridAxis[];
  editingId: string | null;
  editName: string;
  reorderMode: boolean;
  onStartEdit: (axis: AxisGridAxis) => void;
  onSave: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onDrop: (fromIdx: number, toIdx: number) => void;
  setEditName: (v: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  if (axes.length === 0) {
    return <div className="px-4 py-4 text-center text-xs" style={{ color: "var(--ds-text-faint)" }}>Нет осей</div>;
  }

  return (
    <ul>
      {axes.map((axis, idx) => (
        <li
          key={axis.id}
          className={`flex items-center gap-2 px-4 py-1.5 group ${reorderMode ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            borderBottom: idx < axes.length - 1 ? "1px solid var(--ds-border)" : "none",
            ...(dropTarget === idx && dragIdx !== null && dragIdx !== idx ? { borderTop: "2px solid var(--ds-accent)" } : {}),
            ...(dragIdx === idx ? { opacity: 0.4 } : {}),
          }}
          draggable={reorderMode && editingId !== axis.id}
          onDragStart={(e) => { if (!reorderMode) return; setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { if (!reorderMode || dragIdx === null) return; e.preventDefault(); setDropTarget(idx); }}
          onDragLeave={() => { if (dropTarget === idx) setDropTarget(null); }}
          onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) onDrop(dragIdx, idx); setDragIdx(null); setDropTarget(null); }}
          onDragEnd={() => { setDragIdx(null); setDropTarget(null); }}
          onMouseEnter={(e) => { if (!reorderMode) e.currentTarget.style.background = "var(--ds-surface-sunken)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {reorderMode ? (
            <span className="w-4 flex justify-center shrink-0" style={{ color: "var(--ds-text-faint)" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </span>
          ) : editingId === axis.id ? (
            <>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSave(axis.id)}
                className="ds-input flex-1 !py-0.5 text-sm" autoFocus />
              <button onClick={() => onSave(axis.id)} className="ds-btn !px-2 !py-0.5 text-xs">OK</button>
              <button onClick={onCancelEdit} className="ds-btn-secondary !px-2 !py-0.5 text-xs">Отм.</button>
            </>
          ) : (
            <>
              <span className="w-4 text-xs text-center tabular-nums shrink-0" style={{ color: "var(--ds-text-faint)" }}>{idx + 1}</span>
              <span className="flex-1 text-sm cursor-pointer select-none" style={{ color: "var(--ds-text)" }}
                onDoubleClick={() => onStartEdit(axis)} title="Двойной клик для редактирования">
                {axis.name}
              </span>
              <button onClick={() => onDelete(axis.id)}
                className="ds-icon-btn !p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:!text-red-500"
                style={{ color: "var(--ds-text-faint)" }} title="Удалить">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
          {reorderMode && editingId !== axis.id && (
            <span className="flex-1 text-sm select-none" style={{ color: "var(--ds-text)" }}>{axis.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
