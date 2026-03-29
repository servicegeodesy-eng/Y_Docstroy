import { useState, useEffect, useCallback, useRef } from "react";
import { getToken } from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface BadgeCounts {
  registry: number;
  requests: number;
  fileshare: number;
  notifications: number;
}

const EMPTY: BadgeCounts = { registry: 0, requests: 0, fileshare: 0, notifications: 0 };

/**
 * Хук для реалтайм-бейджей через SSE (Server-Sent Events).
 * Подключается к /api/badges/stream, получает counts при подключении
 * и обновления при каждом NOTIFY из PostgreSQL.
 * Fallback: поллинг /api/badges/counts каждые 60 сек если SSE недоступен.
 */
export function useBadgeCounts(): BadgeCounts & { refresh: () => void } {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fallback: одноразовый fetch counts
  const fetchCounts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/badges/counts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let closed = false;

    // Попытка SSE
    const url = `${API_URL}/api/badges/stream`;
    const es = new EventSource(url, {
      // EventSource не поддерживает headers нативно,
      // поэтому передаём token через query (безопасно по HTTPS)
    });

    // EventSource не поддерживает кастомные headers.
    // Используем fetch-based подход вместо нативного EventSource.
    es.close(); // закрываем нативный — используем свою реализацию

    // Своя реализация SSE через fetch для поддержки Authorization header
    const abortController = new AbortController();

    async function connectSSE() {
      try {
        const response = await fetch(`${API_URL}/api/badges/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          // SSE не поддерживается — fallback на поллинг
          startPolling();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Парсим SSE-события из буфера
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.registry !== undefined) {
                  // Полные counts (при подключении)
                  setCounts(data);
                } else if (data.type) {
                  // Частичное обновление — перезапрашиваем counts
                  fetchCounts();
                }
              } catch { /* ignore malformed */ }
            }
          }
        }
      } catch (err) {
        if (!closed) {
          // SSE disconnected — fallback
          startPolling();
        }
      }
    }

    function startPolling() {
      if (pollTimerRef.current) return;
      fetchCounts();
      pollTimerRef.current = setInterval(fetchCounts, 60000);
    }

    connectSSE();

    return () => {
      closed = true;
      abortController.abort();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchCounts]);

  return { ...counts, refresh: fetchCounts };
}
