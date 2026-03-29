import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { DictionaryItem } from "@/types";

interface Props {
  building: DictionaryItem;
  onBack: () => void;
}

/**
 * Редактор трёхсторонней связи: Место работ + Вид работ → Уровни/срезы.
 * Показывает виды работ, привязанные к данному месту работ,
 * и для каждого позволяет выбрать уровни/виды.
 */
export default function BuildingFloorLinkEditor({ building, onBack }: Props) {
  const { project } = useProject();
  const [workTypes, setWorkTypes] = useState<DictionaryItem[]>([]);
  const [floors, setFloors] = useState<DictionaryItem[]>([]);
  const [linkedWorkTypeIds, setLinkedWorkTypeIds] = useState<string[]>([]);
  // Текущий выбранный вид работ
  const [selectedWt, setSelectedWt] = useState<string | null>(null);
  // Чекбоксы уровней для выбранного вида работ
  const [selectedFloorIds, setSelectedFloorIds] = useState<Set<string>>(new Set());
  // Количество привязанных уровней по виду работ
  const [floorCounts, setFloorCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [building.id]);

  async function loadData() {
    if (!project) return;
    setLoading(true);

    const [wtRes, floorRes, bwtRes, bwtfRes] = await Promise.all([
      supabase.from("dict_work_types").select("*")
        .eq("project_id", project.id)
        .order("sort_order").order("name"),
      supabase.from("dict_floors").select("*")
        .eq("project_id", project.id)
        .order("sort_order").order("name"),
      supabase.from("dict_building_work_types").select("work_type_id")
        .eq("building_id", building.id),
      supabase.from("dict_building_work_type_floors").select("work_type_id, floor_id")
        .eq("building_id", building.id),
    ]);

    if (wtRes.data) setWorkTypes(wtRes.data);
    if (floorRes.data) setFloors(floorRes.data);

    const wtIds = (bwtRes.data || []).map((r: { work_type_id: string }) => r.work_type_id);
    setLinkedWorkTypeIds(wtIds);

    // Подсчёт уровней по виду работ
    const counts: Record<string, number> = {};
    if (bwtfRes.data) {
      for (const row of bwtfRes.data as { work_type_id: string; floor_id: string }[]) {
        counts[row.work_type_id] = (counts[row.work_type_id] || 0) + 1;
      }
    }
    setFloorCounts(counts);
    setLoading(false);
  }

  async function selectWorkType(wtId: string) {
    setSelectedWt(wtId);
    // Загрузить текущие связи
    const { data } = await supabase
      .from("dict_building_work_type_floors")
      .select("floor_id")
      .eq("building_id", building.id)
      .eq("work_type_id", wtId);
    const ids = new Set<string>();
    if (data) {
      for (const row of data) ids.add((row as { floor_id: string }).floor_id);
    }
    setSelectedFloorIds(ids);
  }

  function toggleFloor(id: string) {
    setSelectedFloorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFloors() {
    setSelectedFloorIds(new Set(floors.map((f) => f.id)));
  }

  function selectNoFloors() {
    setSelectedFloorIds(new Set());
  }

  async function saveFloors() {
    if (!selectedWt) return;
    setSaving(true);

    // Удалить текущие связи для этой пары (building, work_type)
    await supabase
      .from("dict_building_work_type_floors")
      .delete()
      .eq("building_id", building.id)
      .eq("work_type_id", selectedWt);

    // Вставить новые
    const ids = Array.from(selectedFloorIds);
    if (ids.length > 0) {
      await supabase.from("dict_building_work_type_floors").insert(
        ids.map((floorId) => ({
          building_id: building.id,
          work_type_id: selectedWt,
          floor_id: floorId,
        })),
      );
    }

    // Обновить счётчик
    setFloorCounts((prev) => ({ ...prev, [selectedWt!]: ids.length }));
    setSaving(false);
    setSelectedWt(null);
  }

  // Экран выбора уровней для конкретного вида работ
  if (selectedWt) {
    const wt = workTypes.find((w) => w.id === selectedWt);
    return (
      <div className="ds-card">
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <button onClick={() => setSelectedWt(null)} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
              {building.name} / {wt?.name}
            </h3>
            <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
              Привязать уровни и виды
            </p>
          </div>
        </div>

        <div className="ds-alert-info mx-0 rounded-none" style={{ borderBottom: "1px solid var(--ds-border)", borderRadius: 0 }}>
          <p className="text-xs">
            Отметьте уровни/виды, доступные для «{building.name}» + «{wt?.name}».
            Если ничего не отмечено — доступны все.
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <button onClick={selectAllFloors} className="text-xs" style={{ color: "var(--ds-accent)" }}>Выбрать все</button>
          <span style={{ color: "var(--ds-text-faint)" }}>|</span>
          <button onClick={selectNoFloors} className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Снять все</button>
          <span className="ml-auto text-xs" style={{ color: "var(--ds-text-faint)" }}>
            {selectedFloorIds.size} из {floors.length}
          </span>
        </div>

        {floors.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
            Справочник «Уровни/срезы» пуст.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {floors.map((f) => (
              <li key={f.id} className="px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFloorIds.has(f.id)}
                    onChange={() => toggleFloor(f.id)}
                    className="rounded"
                    style={{ borderColor: "var(--ds-border-strong)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--ds-text)" }}>{f.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--ds-border)" }}>
          <button onClick={() => setSelectedWt(null)} className="ds-btn-secondary">Отмена</button>
          <button onClick={saveFloors} disabled={saving} className="ds-btn">
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    );
  }

  // Экран списка видов работ
  const linkedWorkTypes = workTypes.filter((wt) => linkedWorkTypeIds.includes(wt.id));

  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
            Уровни/срезы: {building.name}
          </h3>
          <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
            Выберите вид работ для привязки уровней
          </p>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : linkedWorkTypes.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
          К «{building.name}» не привязано ни одного вида работ.
          <br />Сначала настройте связь «Место работ → Вид работ».
        </div>
      ) : (
        <ul>
          {linkedWorkTypes.map((wt, idx) => {
            const count = floorCounts[wt.id] || 0;
            return (
              <li
                key={wt.id}
                style={{ borderBottom: idx < linkedWorkTypes.length - 1 ? "1px solid var(--ds-border)" : "none" }}
              >
                <button
                  onClick={() => selectWorkType(wt.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--ds-surface-sunken)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <span className="flex-1 text-sm" style={{ color: "var(--ds-text)" }}>{wt.name}</span>
                  {count > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" }}>
                      {count} ур.
                    </span>
                  )}
                  <svg className="w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
