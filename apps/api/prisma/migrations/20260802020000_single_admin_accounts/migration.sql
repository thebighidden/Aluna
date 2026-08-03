-- Preserve one existing workspace administrator and convert every other account
-- into an independent Studio user before replacing the legacy role enum.
WITH "selected_admin" AS (
  SELECT "id"
  FROM "users"
  WHERE "role" IN ('OWNER', 'ADMIN')
  ORDER BY
    CASE WHEN "role" = 'OWNER' THEN 0 ELSE 1 END,
    "createdAt" ASC
  LIMIT 1
)
UPDATE "users"
SET "role" = 'CREATOR'
WHERE "role" IN ('OWNER', 'ADMIN')
  AND "id" <> (SELECT "id" FROM "selected_admin");

ALTER TYPE "Role" RENAME TO "Role_legacy";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'USER');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE
      WHEN "role"::text IN ('OWNER', 'ADMIN') THEN 'SUPER_ADMIN'::"Role"
      ELSE 'USER'::"Role"
    END
  );
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

DROP TYPE "Role_legacy";

-- The application has exactly one administrative identity. Normal users can
-- never be promoted through the API, and this index prevents a second super
-- administrator from being inserted directly.
CREATE UNIQUE INDEX "users_single_super_admin"
ON "users" ("role")
WHERE "role" = 'SUPER_ADMIN';
