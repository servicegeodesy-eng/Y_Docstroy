import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { DictionaryItem } from "@/types";

const ZONES: { key: string; label: string }[] = [
  { key: "roof", label: "Кровля" },
  { key: "facades", label: "Фасады" },
  { key: "frame", label: "Каркас" },
  { key: "walls", label: "Стены" },
  { key: "floors", label: "Полы и потолки" },
  { key: "territory", label: "Территория строительства" },
  { key: "landscaping", label: "Благоустройство" },
  { key: "earthwork", label: "Объёмы земляных масс" },
  { key: "foundation", label: "Основание" },
  { key: "shoring", label: "Ограждение котлована" },
  { key: "piles", label: "Сваи" },
];

interface Props {
  onBack: () => void;
}

export default function ZoneWorkTypeManager({ onBack }: Props) {
  const { project } = useProject();
  const [workTypes, setWorkTypes] = useState<DictionaryItem[]>([]);
  const [links, setLinks] = useState<Map<string, Set<string>>>(new Map());
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!project) return;
    setLoading(true);

    const [wtRes, linksRes] = await Promise.all([
      supabase
        .from("dict_work_types")
        .select("*")
        .eq("project_id", project.id)
        .order("sort_order")
        .order("name"),
      supabase
        .from("dict_zone_work_types")
        .select("zone_type, work_type_id")
        .eq("project_id", project.id),
    ]);

    if (wtRes.data) setWorkTypes(wtRes.data);

    const map = new Map<string, Set<string>>();
    if (linksRes.data) {
      for (const row of linksRes.data as { zone_type: string; work_type_id: string }[]) {
        if (!map.has(row.zone_type)) map.set(row.zone_type, new Set());
        map.get(row.zone_type)!.add(row.work_type_id);
      }
    }
    setLinks(map);
    setLoading(false);
  }

  function toggle(wtId: string) {
    if (!activeZone) return;
    setLinks((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(activeZone) || []);
      if (set.has(wtId)) set.delete(wtId); else set.add(wtId);
      next.set(activeZone, set);
      return next;
    });
  }

  function selectAll() {
    if (!activeZone) return;
    setLinks((prev) => {
      const next = new Map(prev);
      next.set(activeZone, new Set(workTypes.map((wt) => wt.id)));
      return next;
    });
  }

  function selectNone() {
    if (!activeZone) return;
    setLinks((prev) => {
      const next = new Map(prev);
      next.set(activeZone, new Set());
      return next;
    });
  }

  async function save() {
    if (!project || !activeZone) return;
    setSaving(true);

    await supabase
      .from("dict_zone_work_types")
      .delete()
      .eq("project_id", project.id)
      .eq("zone_type", activeZone);

    const ids = Array.from(links.get(activeZone) || []);
    if (ids.length > 0) {
      await supabase.from("dict_zone_work_types").insert(
        ids.map((wtId) => ({
          project_id: project.id,
          zone_type: activeZone,
          work_type_id: wtId,
        })),
      );
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="text-center py-16" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>;
  }

  // Редактирование конкретной зоны
  if (activeZone) {
    const zone = ZONES.find((z) => z.key === activeZone)!;
    const selected = links.get(activeZone) || new Set<string>();

    return (
      <div className="ds-card">
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <button onClick={() => setActiveZone(null)} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{zone.label}</h3>
            <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Виды работ для шахматки</p>
          </div>
        </div>

        <div className="ds-alert-info mx-0 rounded-none" style={{ borderBottom: "1px solid var(--ds-border)", borderRadius: 0 }}>
          <p className="text-xs">
            Отметьте виды работ, которые будут отображаться в шахматке зоны «{zone.label}».
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <button onClick={selectAll} className="text-xs" style={{ color: "var(--ds-accent)" }}>Выбрать все</button>
          <span style={{ color: "var(--ds-text-faint)" }}>|</span>
          <button onClick={selectNone} className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Снять все</button>
          <span className="ml-auto text-xs" style={{ color: "var(--ds-text-faint)" }}>{selected.size} из {workTypes.length}</span>
        </div>

        {workTypes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
            Справочник «Вид работ» пуст.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {workTypes.map((wt) => (
              <li key={wt.id} className="px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(wt.id)}
                    onChange={() => toggle(wt.id)}
                    className="rounded"
                    style={{ borderColor: "var(--ds-border-strong)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--ds-text)" }}>{wt.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--ds-border)" }}>
          <button onClick={() => setActiveZone(null)} className="ds-btn-secondary">Отмена</button>
          <button onClick={save} disabled={saving} className="ds-btn">
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    );
  }

  // Список зон
  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>Зоны строительства</h3>
          <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Виды работ для шахматки каждой зоны</p>
        </div>
      </div>

      <ul>
        {ZONES.map((zone) => {
          const count = links.get(zone.key)?.size || 0;
          return (
            <li key={zone.key}>
              <button
                onClick={() => setActiveZone(zone.key)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--ds-surface-raised)]"
                style={{ borderBottom: "1px solid var(--ds-border)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{zone.label}</span>
                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                      {count} {count === 1 ? "вид" : count < 5 ? "вида" : "видов"}
                    </span>
                  )}
                  <svg className="w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
