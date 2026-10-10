CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL PRIMARY KEY, "filename" TEXT NOT NULL, "uploaderId" TEXT, "schoolId" TEXT,
  "contentType" TEXT NOT NULL, "size" INTEGER NOT NULL, "sha256" TEXT,
  "state" TEXT NOT NULL DEFAULT 'STAGED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "FileBinding" (
  "id" TEXT NOT NULL PRIMARY KEY, "assetId" TEXT NOT NULL, "resourceType" TEXT NOT NULL, "resourceId" TEXT NOT NULL,
  CONSTRAINT "FileBinding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FileAsset_filename_key" ON "FileAsset"("filename");
CREATE UNIQUE INDEX "FileBinding_assetId_resourceType_resourceId_key" ON "FileBinding"("assetId", "resourceType", "resourceId");
CREATE INDEX "FileBinding_resourceType_resourceId_idx" ON "FileBinding"("resourceType", "resourceId");
