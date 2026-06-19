import { NextResponse } from "next/server";
import { AiConfigurationError, AiProviderError } from "@/lib/ai/client";
import { startPathway, UserInputError } from "@/lib/agentic/orchestrator";
import type { GeneratePathwayRequest } from "@/lib/agentic/types";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof AiConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof UserInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof AiProviderError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const message = error instanceof Error ? error.message : "Unknown generation error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GeneratePathwayRequest>;
    const result = await startPathway({
      currentCondition: body.currentCondition ?? "",
      dreamLife: body.dreamLife ?? "",
      locale: body.locale ?? "en-MY",
      currency: "MYR",
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
