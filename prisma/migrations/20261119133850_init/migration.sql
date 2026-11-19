-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "rubro" TEXT,
    "barrio" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "plan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nuevo',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
