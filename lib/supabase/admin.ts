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
export function createAdminClient(actor?: string | null) {
  /**
   * `actor` names whoever is responsible for the writes made with this client.
   *
   * It rides along as a request header, which the log_record_change trigger
   * reads through PostgREST's request.headers setting. Doing it here rather
   * than as a column on each audited table means a write path opts into
   * attribution by passing a name, and the change is still logged when it
   * does not — the log records what changed regardless, and only the "who"
   * is best effort.
   */
  const name = (actor ?? "").trim();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    name
      ? { global: { headers: { "x-brandbook-actor": name.slice(0, 120) } } }
      : undefined
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
