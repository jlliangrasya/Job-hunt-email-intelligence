"use client";
import { useState, useEffect } from "react";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppShell({ userId, user, children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(({ notifications: n }) => setNotifications(n ?? []))
      .catch(() => {});
  }, []);

  function handleNotification(notification) {
    setNotifications((prev) => [notification, ...prev]);
  }

  function handleMarkRead(ids) {
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <RealtimeProvider userId={userId} onNotification={handleNotification}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopNav
            user={user}
            notificationCount={unreadCount}
            notifications={notifications}
            onMarkRead={handleMarkRead}
          />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
