import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { mapHistoryRow, type HistoryRow } from "@/lib/history/types";
import {
  getSupabaseAdmin,
  PATHWAY_HISTORY_TABLE,
  SupabaseConfigurationError,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  const message = error instanceof Error ? error.message : "Unknown history error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function validateSessionId(sessionId: string | null | undefined) {
  const value = sessionId?.trim();
  return value && value.length >= 12 ? value : null;
}

function isMissingHistoryTable(error: PostgrestError) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message.toLowerCase().includes("schema cache")
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionId = validateSessionId(new URL(request.url).searchParams.get("sessionId"));
    const { id } = await context.params;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(PATHWAY_HISTORY_TABLE)
      .select("id, session_id, current_condition, dream, pathways, title, created_at")
      .eq("id", id)
      .eq("session_id", sessionId)
      .single();

    if (error) {
      if (isMissingHistoryTable(error)) {
        return NextResponse.json(
          {
            error:
              "Supabase table public.pathway_history is missing or the schema cache has not refreshed. Run supabase/pathway_history.sql in the Supabase SQL Editor, then retry.",
          },
          { status: 503 },
        );
      }

      if (error.code === "42703" || error.message.toLowerCase().includes("column")) {
        return NextResponse.json(
          {
            error:
              "Supabase table public.pathway_history exists but its columns do not match the app. Run the updated supabase/pathway_history.sql in the Supabase SQL Editor, then restart the app.",
          },
          { status: 503 },
        );
      }

      if (error.code === "42501" || error.message.toLowerCase().includes("row-level security")) {
        return NextResponse.json(
          {
            error:
              "Supabase row-level security blocked history loading. Use the service_role key in SUPABASE_SERVICE_ROLE_KEY, or rerun the updated supabase/pathway_history.sql to add anonymous session policies.",
          },
          { status: 503 },
        );
      }

      const status = error.code === "PGRST116" ? 404 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ item: mapHistoryRow(data as HistoryRow) });
  } catch (error) {
    return errorResponse(error);
  }
}
