import "server-only";
import { supabaseConfigured } from "@/lib/env";
import { memoryDb } from "./memory";
import { supabaseDb } from "./supabase";
import type { Db } from "./types";

export function db(): Db {
  return supabaseConfigured() ? supabaseDb : memoryDb;
}

export type { Db } from "./types";
