import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";

interface Company {
  id: string;
  name: string;
}

interface TemplateItem {
  id: string;
  name: string;
  sort_order: number;
}

const TEMPLATE_TABLES = [
  { key: "company_tpl_buildings", label: "Место работ" },
  { key: "company_tpl_work_types", label: "Вид работ" },
  { key: "company_tpl_floors", label: "Уровни/срезы" },
  { key: "company_tpl_constructions", label: "Конструкция" },
  { key: "company_tpl_sets", label: "Комплект" },
  { key: "company_tpl_organizations", label: "Компания" },
] as const;

type TableKey = typeof TEMPLATE_TABLES[number]["key"];

export default function CompanyTemplatesModal({
  company,
  onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TableKey>("company_tpl_buildings");
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    loadItems();
  }, [activeTab, company.id]);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from(activeTab)
      .select("id, name, sort_order")
      .eq("company_id", company.id)
      .order("sort_order", { ascending: true });
    if (data) setItems(data as TemplateItem[]);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from(activeTab).insert({
      company_id: company.id,
      name: newName.trim(),
      sort_order: maxSort,
    });
    if (!error) {
      setNewName("");
      await loadItems();
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить «${name}»?`)) return;
    await supabase.from(activeTab).delete().eq("id", id);
    await loadItems();
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    await supabase.from(activeTab).update({ name: editingName.trim() }).eq("id", id);
    setEditingId(null);
    setEditingName("");
    await loadItems();
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const current = items[index];
    const prev = items[index - 1];
    await Promise.all([
      supabase.from(activeTab).update({ sort_order: prev.sort_order }).eq("id", current.id),
      supabase.from(activeTab).update({ sort_order: current.sort_order }).eq("id", prev.id),
    ]);
    await loadItems();
  }

  async function handleMoveDown(index: number) {
    if (index >= items.length - 1) return;
    const current = items[index];
    const next = items[index + 1];
    await Promise.all([
      supabase.from(activeTab).update({ sort_order: next.sort_order }).eq("id", current.id),
      supabase.from(activeTab).update({ sort_order: current.sort_order }).eq("id", next.id),
    ]);
    await loadItems();
  }

  const activeLabel = TEMPLATE_TABLES.find((t) => t.key === activeTab)?.label ?? "";

  return (
    <Modal open onClose={onClose} title={`Шаблоны — ${company.name}`} wide>
      <div className="space-y-4">
        {/* Вкладки */}
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_TABLES.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === t.key ? "ds-btn" : "ds-btn-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Добавление */}
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="ds-input flex-1"
            placeholder={`Новый элемент в «${activeLabel}»`}
          />
          <button onClick={handleAdd} disabled={!newName.trim()} className="ds-btn shrink-0">
            Добавить
          </button>
        </div>

        {/* Список */}
        {loading ? (
          <div className="text-center py-8">
            <div className="ds-spinner mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--ds-text-muted)" }}>
            Нет элементов. Добавьте шаблонные значения, которые будут копироваться в новые проекты.
          </p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-auto">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg group"
                style={{ background: "var(--ds-surface-sunken)" }}
              >
                {/* Сортировка */}
                <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="ds-icon-btn !p-0"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx >= items.length - 1}
                    className="ds-icon-btn !p-0"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Имя */}
                {editingId === item.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(item.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleRename(item.id)}
                    autoFocus
                    className="ds-input flex-1 text-sm py-0.5"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm cursor-pointer"
                    style={{ color: "var(--ds-text)" }}
                    onDoubleClick={() => {
                      setEditingId(item.id);
                      setEditingName(item.name);
                    }}
                    title="Двойной клик для редактирования"
                  >
                    {item.name}
                  </span>
                )}

                {/* Удалить */}
                <button
                  onClick={() => handleDelete(item.id, item.name)}
                  className="ds-icon-btn !p-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Удалить"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
          Шаблоны копируются в справочники при создании нового проекта в этой компании.
          Двойной клик для переименования.
        </p>
      </div>
    </Modal>
  );
}
