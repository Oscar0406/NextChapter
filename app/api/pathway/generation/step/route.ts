import { NextResponse } from "next/server";
import { advancePathwayGeneration, UserInputError } from "@/lib/agentic/orchestrator";
import type { PathwayGenerationStepRequest } from "@/lib/agentic/types";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof UserInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Unknown generation step error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PathwayGenerationStepRequest>;

    if (!body.run) {
      return NextResponse.json({ error: "Missing generation run." }, { status: 400 });
    }

    const result = await advancePathwayGeneration(body.run);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
