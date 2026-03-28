import { storage } from "./api";

interface CacheEntry {
  url: string;
  expiresAt: number; // timestamp ms
}

// Кеш: storage_path → { url, expiresAt }
const cache = new Map<string, CacheEntry>();
// In-flight запросы для дедупликации
const pending = new Map<string, Promise<string | null>>();
// Порядок добавления для LRU (последний — самый свежий)
const lruOrder: string[] = [];

const TTL_MS = 50 * 60 * 1000; // 50 минут (signed URL живёт 60 мин)
const MAX_CACHE_SIZE = 5; // Максимум подложек в кэше
const CLEANUP_INTERVAL_MS = isMobileDevice() ? 15 * 60 * 1000 : 5 * 60 * 1000;

function isMobileDevice(): boolean {
  return window.innerWidth < 768;
}

function preloadImage(url: string): void {
  // Используем fetch вместо Image() — не создаёт DOM-объект, не утекает память
  fetch(url, { mode: "no-cors" }).catch(() => {});
}

/** Обновить позицию ключа в LRU */
function touchLru(key: string): void {
  const idx = lruOrder.indexOf(key);
  if (idx !== -1) lruOrder.splice(idx, 1);
  lruOrder.push(key);
}

/** Удалить самые старые записи если кэш превышает лимит */
function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_SIZE && lruOrder.length > 0) {
    const oldest = lruOrder.shift()!;
    cache.delete(oldest);
  }
}

/** Удалить просроченные записи */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
      const idx = lruOrder.indexOf(key);
      if (idx !== -1) lruOrder.splice(idx, 1);
    }
  }
}

// Автоочистка просроченных записей (запускается один раз, guard от дублирования)
let cleanupStarted = false;
function startCleanupIfNeeded(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
}
startCleanupIfNeeded();

/**
 * Получить signed URL для подложки из кеша или сгенерировать новый.
 * На мобильных: LRU-кэш макс. 5 подложек.
 */
export async function getOverlayUrl(storagePath: string): Promise<string | null> {
  const cached = cache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) {
    touchLru(storagePath);
    return cached.url;
  }

  const inflight = pending.get(storagePath);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data } = await storage
        .from("overlay-images")
        .createSignedUrl(storagePath, 3600);

      if (data?.signedUrl) {
        cache.set(storagePath, {
          url: data.signedUrl,
          expiresAt: Date.now() + TTL_MS,
        });
        touchLru(storagePath);

        // На мобильных: ограничиваем кэш
        if (isMobileDevice()) {
          evictIfNeeded();
        }

        // Предзагрузка изображения — только на десктопе
        if (!isMobileDevice()) {
          preloadImage(data.signedUrl);
        }

        return data.signedUrl;
      }
      return null;
    } finally {
      pending.delete(storagePath);
    }
  })();

  pending.set(storagePath, promise);
  return promise;
}

const PRELOAD_CONCURRENCY = 3;

/**
 * Предзагрузить URL для нескольких подложек.
 * На мобильных — пропускается (загружается только текущая по запросу).
 */
export function preloadOverlayUrls(storagePaths: string[]): void {
  if (isMobileDevice()) return; // На мобильных не предзагружаем

  (async () => {
    for (let i = 0; i < storagePaths.length; i += PRELOAD_CONCURRENCY) {
      const batch = storagePaths.slice(i, i + PRELOAD_CONCURRENCY);
      await Promise.all(batch.map(getOverlayUrl));
    }
  })();
}
