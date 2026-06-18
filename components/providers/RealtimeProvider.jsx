"use client";

import { useEffect } from "react";
import { useSupabase } from "./SupabaseProvider";

export function RealtimeProvider({ userId, onApplicationChange, onNotification, children }) {
  const supabase = useSupabase();

  useEffect(() => {
    const channel = supabase
      .channel(`user-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${userId}` },
        (payload) => onApplicationChange?.(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => onNotification?.(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, onApplicationChange, onNotification]);

  return <>{children}</>;
}
