import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { DictionaryItem, DictLinkConfig } from "@/types";

interface Props {
  parentItem: DictionaryItem;
  linkConfig: DictLinkConfig;
  onBack: () => void;
}

export default function DictionaryLinkEditor({ parentItem, linkConfig, onBack }: Props) {
  const { project } = useProject();
  const [childItems, setChildItems] = useState<DictionaryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [parentItem.id]);

  async function loadData() {
    if (!project) return;
    setLoading(true);

    const [childRes, linksRes] = await Promise.all([
      supabase
        .from(linkConfig.childTable)
        .select("*")
        .eq("project_id", project.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from(linkConfig.linkTable)
        .select(linkConfig.childFk)
        .eq(linkConfig.parentFk, parentItem.id),
    ]);

    if (childRes.data) setChildItems(childRes.data);

    const linked = new Set<string>();
    if (linksRes.data) {
      for (const row of linksRes.data) {
        linked.add((row as any)[linkConfig.childFk]);
      }
    }
    setSelectedIds(linked);
    setLoading(false);
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(childItems.map((c) => c.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function save() {
    setSaving(true);
    // Удалить все текущие связи
    await supabase
      .from(linkConfig.linkTable)
      .delete()
      .eq(linkConfig.parentFk, parentItem.id);

    // Вставить выбранные
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      await supabase.from(linkConfig.linkTable).insert(
        ids.map((childId) => ({
          [linkConfig.parentFk]: parentItem.id,
          [linkConfig.childFk]: childId,
        })),
      );
    }
    setSaving(false);
    onBack();
  }

  return (
    <div className="ds-card">
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>
            Связи: {parentItem.name}
          </h3>
          <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
            Привязать {linkConfig.childLabel.toLowerCase()}
          </p>
        </div>
      </div>

      {/* Подсказка */}
      <div className="ds-alert-info mx-0 rounded-none" style={{ borderBottom: "1px solid var(--ds-border)", borderRadius: 0 }}>
        <p className="text-xs">
          Отметьте элементы, которые доступны для «{parentItem.name}».
          Если ничего не отмечено — доступны все.
        </p>
      </div>

      {/* Кнопки выбора */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button
          onClick={selectAll}
          className="text-xs" style={{ color: "var(--ds-accent)" }}
        >
          Выбрать все
        </button>
        <span style={{ color: "var(--ds-text-faint)" }}>|</span>
        <button
          onClick={selectNone}
          className="text-xs" style={{ color: "var(--ds-text-faint)" }}
        >
          Снять все
        </button>
        <span className="ml-auto text-xs" style={{ color: "var(--ds-text-faint)" }}>
          {selectedIds.size} из {childItems.length}
        </span>
      </div>

      {/* Список */}
      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : childItems.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Справочник «{linkConfig.childLabel}» пуст.
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {childItems.map((item) => (
            <li key={item.id} className="px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="rounded"
                  style={{ borderColor: "var(--ds-border-strong)" }}
                />
                <span className="text-sm" style={{ color: "var(--ds-text)" }}>{item.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* Кнопка сохранения */}
      <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--ds-border)" }}>
        <button
          onClick={onBack}
          className="ds-btn-secondary"
        >
          Отмена
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="ds-btn"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
