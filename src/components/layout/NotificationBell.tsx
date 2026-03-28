import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { usePushNotifications } from "@/lib/usePushNotifications";

interface Notification {
  id: string;
  title: string;
  body: string;
  url: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин. назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;
  return new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function NotificationBell({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();

  // Стабильная ссылка на актуальный callback, чтобы интервал не пересоздавался
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  // Лёгкий запрос — только count непрочитанных (каждые 15 сек)
  const loadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (count !== null) {
      setUnreadCount(count);
      onCountChangeRef.current?.(count);
    }
  }, [user]);

  // Полная загрузка — только при открытии панели
  const loadFull = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, url, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
  }, [user]);

  // Polling — только count (мобильные: 60с, десктоп: 15с)
  useEffect(() => {
    if (!user) return;
    loadCount();
    const interval = setInterval(loadCount, isMobile ? 60000 : 15000);
    return () => clearInterval(interval);
  }, [user, isMobile]);

  // При открытии панели — загрузить полный список
  useEffect(() => {
    if (open) loadFull();
  }, [open, loadFull]);

  // Закрытие по клику вне панели
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    setOpen(false);
    navigate(n.url);
  };

  const filtered = tab === "new"
    ? notifications.filter((n) => !n.is_read)
    : notifications.filter((n) => n.is_read);

  return (
    <div className="relative" ref={panelRef}>
      {/* Кнопка-колокольчик */}
      <button
        onClick={() => setOpen(!open)}
        className="ds-icon-btn relative"
        title="Уведомления"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500" />
        )}
      </button>

      {/* Панель уведомлений */}
      {open && isMobile && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setOpen(false)} />
      )}
      {open && (
        <div
          className={isMobile
            ? "fixed left-0 right-0 bottom-0 z-50 max-h-[80vh] rounded-t-2xl shadow-2xl overflow-hidden flex flex-col"
            : "absolute right-0 top-full mt-2 w-80 max-h-[70vh] rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          }
          style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}
        >
          {/* Шапка с табами */}
          <div className="flex items-center border-b" style={{ borderColor: "var(--ds-border)" }}>
            <button
              onClick={() => setTab("new")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === "new" ? "border-b-2" : "opacity-60"
              }`}
              style={tab === "new" ? { color: "var(--ds-accent)", borderColor: "var(--ds-accent)" } : { color: "var(--ds-text-muted)" }}
            >
              Новые
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === "history" ? "border-b-2" : "opacity-60"
              }`}
              style={tab === "history" ? { color: "var(--ds-accent)", borderColor: "var(--ds-accent)" } : { color: "var(--ds-text-muted)" }}
            >
              История
            </button>
          </div>

          {/* Кнопка «Прочитать всё» */}
          {tab === "new" && unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="w-full py-1.5 text-xs text-center hover:underline"
              style={{ color: "var(--ds-accent)" }}
            >
              Прочитать всё
            </button>
          )}

          {/* Список */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(70vh - 80px)" }}>
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {tab === "new" ? "Нет новых уведомлений" : "История пуста"}
                </p>
              </div>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-4 py-3 hover:brightness-95 transition-colors flex gap-3 items-start"
                  style={{ borderBottom: "1px solid var(--ds-border)" }}
                >
                  {/* Точка для непрочитанных */}
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  )}
                  <div className={`min-w-0 flex-1 ${n.is_read ? "pl-5" : ""}`}>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>
                      {n.title}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ds-text-muted)" }}>
                      {n.body}
                    </p>
                    <p className="text-[10px] mt-1 opacity-50" style={{ color: "var(--ds-text-faint)" }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Push-уведомления — переключатель и тест */}
          {pushState !== "unsupported" && pushState !== "loading" && (
            <div
              className="px-4 py-2.5 shrink-0 space-y-2"
              style={{ borderTop: "1px solid var(--ds-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
                  {pushState === "denied" ? "Push запрещены в настройках" : "Push-уведомления"}
                </span>
                <button
                  onClick={pushState === "subscribed" ? pushUnsubscribe : pushSubscribe}
                  disabled={pushState === "denied"}
                  className="relative w-9 h-5 rounded-full transition-colors shrink-0"
                  style={{
                    background: pushState === "subscribed" ? "var(--ds-accent)" : "var(--ds-border)",
                    opacity: pushState === "denied" ? 0.4 : 1,
                    cursor: pushState === "denied" ? "not-allowed" : "pointer",
                  }}
                  title={pushState === "denied" ? "Разрешите уведомления в настройках браузера" : undefined}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: pushState === "subscribed" ? "calc(100% - 1.125rem)" : "0.125rem" }}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

