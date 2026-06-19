# NextChapter

NextChapter is a Malaysia-oriented agentic AI pathway planner. Users enter their current condition and dream life, answer one follow-up question at a time when needed, then receive 1-3 practical pathway flowcharts with RM/MYR calculations, feasibility scoring, sacrifices, and detailed reasoning.

> Decision support, not final decision. NextChapter does not guarantee salary, admission, employment, scholarship, visa, awards, or life outcomes.

## What It Does

- Collects two user inputs: `Current condition` and `Dream life`.
- Uses a four-agent backend flow: CollectInfo, Planning, Calculation, and Output.
- Asks model-generated follow-up questions one at a time.
- Grounds assumptions in Malaysia by default: RM/MYR, Malaysian locations, education routes, salaries, and cost of living.
- Allows international pathways only when the user explicitly asks.
- Generates 1-3 pathway flowcharts with execution steps, estimated feasibility, sacrifices, and expectation mismatches.
- Shows detailed reasoning, formula traces, source assumptions, and financial projections through `Show details`.
- Saves pathway history in Supabase using an anonymous browser session.
- Uses a Supabase-backed web-grounding cache to reduce repeated Gemini Google Search calls.
- Splits long generation into resumable browser stages so users do not need to redo follow-up answers after a timeout.

## Agent Workflow

1. **CollectInfo Agent**
   Validates user input, summarizes the goal, detects overlooked issues, and creates any needed follow-up questions.

2. **Planning Agent**
   Receives the finalized CollectInfo summary, decides whether fresh web grounding is useful, and creates 1-3 pathway candidates.

3. **Calculation Agent**
   Runs deterministic formulas for salary projection, living cost, education cost, NPV, expected NPV, break-even, risk, feasibility, and ranking.

4. **Output Agent**
   Formats the pathway flowcharts, execution-step details, sacrifice notes, answered follow-ups, and `Show details` content.

The user only sees the simple planner interface. Agent complexity stays behind the API layer.

## Resumable Generation

Long final generation is split into stages and stored in browser `localStorage` while in progress:

1. `search_decision`
2. `web_grounding`
3. `planning_candidates`
4. `calculation`
5. `complete`

If the page refreshes or a provider call pauses, NextChapter can resume from the saved stage on the same browser. Web grounding can fall back to the curated Malaysia dataset if external search repeatedly fails.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` before generating pathways:

```bash
FREELLMAPI_API_KEY=freellmapi-your-unified-key
FREELLMAPI_BASE_URL=http://localhost:3001/v1
FREELLMAPI_MODEL=auto
FREELLMAPI_GEMINI_SEARCH_MODEL=gemini-2.5-flash
WEB_SEARCH_MODE=auto
WEB_GROUNDING_CACHE_MODE=enabled
WEB_GROUNDING_CACHE_TTL_DAYS=7
WEB_GROUNDING_CACHE_MIN_SCORE=0.55
LLM_TIMEOUT_MS=180000
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-server-side-service-role-key
```

Generation is intentionally disabled without `FREELLMAPI_API_KEY`. FreeLLMAPI runs separately, usually on `http://localhost:3001`. Add upstream provider keys inside its dashboard, then copy the unified `freellmapi-...` key into this app.

Use the Supabase `service_role` secret key for `SUPABASE_SERVICE_ROLE_KEY`, not the public `anon` key. The key is only read by server-side API routes and must not be prefixed with `NEXT_PUBLIC_`.

## Supabase History

History is saved server-side in Supabase. The browser stores only an anonymous session ID, so no login feature is required.

Run the setup script in Supabase SQL Editor:

```bash
supabase/pathway_history.sql
```

The app stores pathway flowcharts, CollectInfo summary, answered questions, and responsible AI notice in `public.pathway_history`.

## Web Grounding Cache

To reduce repeated Gemini Google Search calls, run:

```bash
supabase/web_grounding_cache.sql
```

The cache stores sanitized public search context, source links, and deterministic intent/location facets. It is intentionally strict: AI engineering, machine learning engineering, data science, and data analysis are not treated as automatically interchangeable.

`WEB_SEARCH_MODE` options:

- `auto`: search only when fresh context is useful.
- `always`: run Gemini Google Search grounding before every final pathway generation.
- `disabled`: use only the curated Malaysia dataset.

## Data

Malaysia benchmarks live in `malaysia_dataset.ts`. The app uses this dataset for:

- salary ranges
- city cost of living
- education costs
- qualification assumptions
- sector wage benchmarks
- source metadata

Live web grounding is used for context, not for direct RM calculations. Deterministic formulas and the Malaysia dataset remain the source of numeric planning calculations.

## Commands

```bash
npm run dev
npm run typecheck
npm run build
```
