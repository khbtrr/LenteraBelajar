-- Deduplicate duplicate AssignmentSubmission rows, keeping the graded row or the latest submitted row
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "assignmentId", "userId"
           ORDER BY CASE WHEN score IS NOT NULL THEN 0 ELSE 1 END,
                    "submittedAt" DESC,
                    id DESC
         ) AS rank
  FROM "AssignmentSubmission"
)
DELETE FROM "AssignmentSubmission"
WHERE id IN (
  SELECT id FROM ranked WHERE rank > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_userId_key" ON "AssignmentSubmission"("assignmentId", "userId");
