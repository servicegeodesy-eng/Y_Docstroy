import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/AuthContext";
import { MobileProvider } from "./lib/MobileContext";
import { ThemeProvider } from "./lib/ThemeContext";
import App from "./App";
import { isGeoMode } from "./lib/geoMode";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // Очищать неиспользуемые запросы из памяти через 10 мин
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Авто-перезагрузка при ошибке загрузки чанка (устаревший кэш после деплоя)
window.addEventListener("unhandledrejection", (e) => {
  if (e.reason?.message?.includes("dynamically imported module") || e.reason?.message?.includes("Failed to fetch")) {
    const key = "chunk_reload";
    const last = sessionStorage.getItem(key);
    if (!last || Date.now() - Number(last) > 10000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }
});

// Принудительное обновление Service Worker при старте PWA (guard от повторного навешивания)
if ("serviceWorker" in navigator && !(window as any).__swListenersAttached) {
  (window as any).__swListenersAttached = true;
  let refreshing = false;

  // Перезагрузить страницу когда новый SW берёт контроль (один раз)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;
    // Проверить обновления
    reg.update().catch(() => {});
    // Если новый SW ждёт активации — активировать немедленно
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          newSW.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  });
}

if (isGeoMode()) {
  document.title = "Служба Геодезии";
  const oldFavicon = document.querySelector("link[rel='icon']");
  if (oldFavicon) oldFavicon.remove();
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 36 36">' +
    '<defs>' +
    '<linearGradient id="s" x1="0" y1="0" x2=".3" y2="1"><stop offset="0%" stop-color="#3B6A9C"/><stop offset="100%" stop-color="#0E2440"/></linearGradient>' +
    '<linearGradient id="g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0%" stop-color="#FFD19A"/><stop offset="100%" stop-color="#C25A00"/></linearGradient>' +
    '</defs>' +
    '<path d="M22 7L22 8A6 6 0 0 0 16 2L10 2A6 6 0 0 0 4 8L4 24A6 6 0 0 0 10 30L16 30A6 6 0 0 0 22 24L22 22" stroke="url(#s)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<path d="M18 7L18 8A2 2 0 0 0 16 6L10 6A2 2 0 0 0 8 8L8 22" stroke="url(#g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>'
  );
  document.head.appendChild(link);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MobileProvider>
            <BrowserRouter
              future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
              <App />
            </BrowserRouter>
          </MobileProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
