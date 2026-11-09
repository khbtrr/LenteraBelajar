-- Clear stale enrollment cohortId where student is no longer in CohortMember
UPDATE "Enrollment" e
SET "cohortId" = NULL
WHERE e."cohortId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CohortMember" cm
    WHERE cm."userId" = e."userId" AND cm."cohortId" = e."cohortId"
  );
