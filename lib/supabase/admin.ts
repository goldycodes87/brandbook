import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * The service-role client, typed against the real schema.
 *
 * The generic is the whole point. Without it every query in the app was
 * `any`: a filter on a column that does not exist compiled fine, threw at
 * runtime, and — inside the try/catch these queries usually sit in — read as
 * a confident zero. That is how the dashboard showed 0 confirmed pregnant
 * through calving planning, and how bulk health saved its batch record
 * nowhere for months.
 *
 * With it, `lib/database.types.ts` is enforced at build time. When the schema
 * changes, regenerate that file (Supabase MCP → generate_typescript_types)
 * and the compiler will point at every query that needs updating.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

/**
 * Shorthands for the shapes a write takes.
 *
 * Routes here build their payloads a key at a time from an allowlist, so the
 * object cannot be an object literal the compiler checks in one go. Declaring
 * the accumulator as `Update<'animals'>` rather than `Record<string, unknown>`
 * gets the check back: an unknown column is a build error at the line that
 * writes it.
 */
export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];
