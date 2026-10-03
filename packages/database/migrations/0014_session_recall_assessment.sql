-- Mandatory retrieval exercises apply to new sessions through the API. Historical sessions stay null.
-- JSON stores the immutable versioned checklist, not a factual correctness/retention percentage.
ALTER TABLE "reading_sessions" ADD COLUMN IF NOT EXISTS "recall_exercise" jsonb;
ALTER TABLE "reading_sessions" ADD COLUMN IF NOT EXISTS "recall_assessment" jsonb;

ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_recall_pair_check" CHECK (
  (
  ("recall_exercise" IS NULL AND "recall_assessment" IS NULL)
  OR (
    "recall_exercise" IS NOT NULL AND "recall_assessment" IS NOT NULL
    AND jsonb_typeof("recall_exercise") = 'object'
    AND jsonb_typeof("recall_assessment") = 'object'
    AND "recall_exercise" ?& ARRAY['idea', 'detail', 'connection']
    AND "recall_assessment" ?& ARRAY['version', 'passed', 'score', 'kind', 'factualVerification', 'checks', 'feedback']
    AND jsonb_typeof("recall_exercise"->'idea') = 'string'
    AND jsonb_typeof("recall_exercise"->'detail') = 'string'
    AND jsonb_typeof("recall_exercise"->'connection') = 'string'
    AND jsonb_typeof("recall_assessment"->'passed') = 'boolean'
    AND jsonb_typeof("recall_assessment"->'score') = 'number'
    AND jsonb_typeof("recall_assessment"->'checks') = 'array'
    AND jsonb_typeof("recall_assessment"->'feedback') = 'string'
    AND "recall_assessment"->>'version' = 'bubo-recall-v1'
    AND "recall_assessment"->>'passed' = 'true'
    AND "recall_assessment"->>'score' = '100'
    AND "recall_assessment"->>'kind' = 'writing_checklist'
    AND "recall_assessment"->>'factualVerification' = 'unavailable'
  )
  ) IS TRUE
);
