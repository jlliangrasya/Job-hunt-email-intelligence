"use client";
import { NotificationBell } from "./NotificationBell";

export function TopNav({ user, notificationCount, notifications, onMarkRead }) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0 bg-background shadow-sm">
      <div />
      <div className="flex items-center gap-4">
        <NotificationBell
          count={notificationCount}
          notifications={notifications}
          onMarkRead={onMarkRead}
        />
        <span className="bg-muted rounded-full px-3 py-1 text-sm text-foreground">{user.email}</span>
      </div>
    </header>
  );
}
