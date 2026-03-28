// Принудительная активация нового SW по запросу из приложения
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Обработчик push-уведомлений (дополнение к основному SW от vite-plugin-pwa)

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "DocStroy", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/pwa-192.png",
    badge: data.badge || "/pwa-192.png",
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: "docstroy-" + Date.now(),
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "DocStroy", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Если есть открытая вкладка — фокусируем и переходим
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Иначе открываем новую вкладку
      return clients.openWindow(url);
    })
  );
});
