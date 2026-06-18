"use client";

import { createContext, useContext, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const Context = createContext(undefined);

export function SupabaseProvider({ children }) {
  const [supabase] = useState(() => createClient());
  return <Context.Provider value={{ supabase }}>{children}</Context.Provider>;
}

export function useSupabase() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx.supabase;
}
