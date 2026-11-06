import type { CounterDelta, Table, TableRows } from "@/lib/types";

export type Eq = Record<string, string | number | boolean | null>;

export interface SelectOpts {
  eq?: Eq;
  in?: { col: string; values: (string | number)[] };
  order?: { col: string; asc?: boolean };
  limit?: number;
}

export interface Db {
  mode: "memory" | "supabase";
  select<T extends Table>(table: T, opts?: SelectOpts): Promise<TableRows[T][]>;
  one<T extends Table>(table: T, eq: Eq): Promise<TableRows[T] | null>;
  insert<T extends Table>(table: T, row: Partial<TableRows[T]>): Promise<TableRows[T]>;
  /** Insert unless a row with the same values in keyCols exists. Returns the new row, or null if it existed. */
  insertIfAbsent<T extends Table>(
    table: T,
    row: Partial<TableRows[T]>,
    keyCols: string[],
  ): Promise<TableRows[T] | null>;
  update<T extends Table>(table: T, eq: Eq, patch: Partial<TableRows[T]>): Promise<TableRows[T][]>;
  bumpCounters(delta: CounterDelta): Promise<void>;
  resetDemo(): Promise<void>;
}

export interface ChangeEvent {
  table: Table | "*";
  eventType: "INSERT" | "UPDATE" | "DELETE" | "RESET";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}
