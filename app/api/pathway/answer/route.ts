import { NextResponse } from "next/server";
import { AiConfigurationError, AiProviderError } from "@/lib/ai/client";
import { answerPathway, UserInputError } from "@/lib/agentic/orchestrator";
import type { AnswerPathwayRequest } from "@/lib/agentic/types";

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
    const body = (await request.json()) as Partial<AnswerPathwayRequest>;

    if (!body.state) {
      return NextResponse.json({ error: "Missing follow-up state." }, { status: 400 });
    }

    const result = await answerPathway({
      state: body.state,
      answer: body.answer ?? "",
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
