ALTER TYPE "AcademicYearStatus" ADD VALUE 'PLANNED';
CREATE UNIQUE INDEX "AcademicYear_one_active_per_school" ON "AcademicYear"("schoolId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "CourseRequest_courseId_key" ON "CourseRequest"("courseId");
