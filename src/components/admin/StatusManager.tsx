import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { COLOR_PALETTE } from "@/constants/colorPalette";
import { getStatusStyle } from "@/constants/statusColors";

interface StatusRow {
  id: string;
  name: string;
  color_key: string;
  sort_order: number;
  is_default: boolean;
}

export default function StatusManager({ onBack }: { onBack: () => void }) {
  const { project } = useProject();
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorEditId, setColorEditId] = useState<string | null>(null);

  useEffect(() => { loadStatuses(); }, [project]);

  async function loadStatuses() {
    if (!project) return;
    const { data } = await supabase
      .from("project_statuses")
      .select("id, name, color_key, sort_order, is_default")
      .eq("project_id", project.id)
      .order("sort_order");
    if (data) {
      setStatuses(data.map((s: { id: string; name: string; color_key: string; sort_order: number; is_default: boolean }) => ({
        id: s.id,
        name: s.name,
        color_key: s.color_key,
        sort_order: s.sort_order,
        is_default: s.is_default,
      })));
    }
    setLoading(false);
  }

  async function changeColor(id: string, colorKey: string) {
    await supabase.from("project_statuses").update({ color_key: colorKey }).eq("id", id);
    setStatuses((prev) => prev.map((s) => s.id === id ? { ...s, color_key: colorKey } : s));
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
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>Статусы</h3>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>({statuses.length})</span>
      </div>

      {/* Список статусов */}
      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : (
        <ul>
          {statuses.map((s) => (
            <li key={s.id} className="px-4 py-3 group" style={{ borderBottom: "1px solid var(--ds-border)" }}>
              <div className="flex items-center gap-3">
                {/* Бейдж-превью */}
                <span
                  className="inline-block w-[154px] text-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                  style={getStatusStyle(s.color_key, null)}
                >
                  {s.name}
                </span>

                <div className="flex-1" />

                {/* Кнопка смены цвета */}
                <button
                  onClick={() => setColorEditId(colorEditId === s.id ? null : s.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    colorEditId !== s.id ? "" : ""
                  }`}
                  style={colorEditId === s.id
                    ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }
                    : { color: "var(--ds-text-faint)" }
                  }
                  title="Сменить цвет"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <span>Цвет</span>
                </button>
              </div>

              {/* Палитра цветов (раскрывается) */}
              {colorEditId === s.id && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid var(--ds-border)" }}>
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => {
                        changeColor(s.id, c.key);
                        setColorEditId(null);
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        s.color_key === c.key ? "scale-110" : "border-transparent"
                      }`}
                      style={{
                        background: c.bg,
                        borderColor: s.color_key === c.key ? "var(--ds-text)" : undefined,
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
