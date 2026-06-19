import type {
  CollectInfoSummary,
  FollowUpAnswer,
  PathwayFlowchartResult,
} from "@/lib/agentic/types";

export type SavedPathwayPlan = {
  id: string;
  sessionId: string;
  currentCondition: string;
  dreamLife: string;
  collectInfoSummary: CollectInfoSummary;
  answeredQuestions: FollowUpAnswer[];
  pathways: PathwayFlowchartResult[];
  responsibleAiNotice: string;
  createdAt: string;
};

export type HistoryRow = {
  id: string;
  session_id?: string | null;
  user_id?: string | null;
  current_condition: string;
  dream?: string | null;
  dream_life?: string | null;
  collect_info_summary?: CollectInfoSummary | null;
  answered_questions?: FollowUpAnswer[] | null;
  pathways: PathwayFlowchartResult[] | StoredPathwayPayload;
  responsible_ai_notice?: string | null;
  title?: string | null;
  created_at: string;
};

export type StoredPathwayPayload = {
  pathways?: PathwayFlowchartResult[];
  collectInfoSummary?: CollectInfoSummary;
  answeredQuestions?: FollowUpAnswer[];
  responsibleAiNotice?: string;
};

export type SavePathwayHistoryRequest = {
  sessionId: string;
  currentCondition: string;
  dreamLife: string;
  collectInfoSummary: CollectInfoSummary;
  answeredQuestions: FollowUpAnswer[];
  pathways: PathwayFlowchartResult[];
  responsibleAiNotice: string;
};

function unpackPathways(value: HistoryRow["pathways"]) {
  if (Array.isArray(value)) {
    return {
      pathways: value,
      collectInfoSummary: undefined,
      answeredQuestions: undefined,
      responsibleAiNotice: undefined,
    };
  }

  return {
    pathways: value.pathways ?? [],
    collectInfoSummary: value.collectInfoSummary,
    answeredQuestions: value.answeredQuestions,
    responsibleAiNotice: value.responsibleAiNotice,
  };
}

export function mapHistoryRow(row: HistoryRow): SavedPathwayPlan {
  const stored = unpackPathways(row.pathways);

  return {
    id: row.id,
    sessionId: row.session_id ?? row.user_id ?? "",
    currentCondition: row.current_condition,
    dreamLife: row.dream ?? row.dream_life ?? "",
    collectInfoSummary: row.collect_info_summary ?? stored.collectInfoSummary ?? {
      currentConditionSummary: row.current_condition,
      dreamLifeSummary: row.dream ?? row.dream_life ?? "",
      planningSummary: row.title ?? "Saved pathway",
      malaysiaAssumptions: [],
      internationalAssumptions: [],
    },
    answeredQuestions: row.answered_questions ?? stored.answeredQuestions ?? [],
    pathways: stored.pathways,
    responsibleAiNotice: row.responsible_ai_notice ?? stored.responsibleAiNotice ?? "",
    createdAt: row.created_at,
  };
}
