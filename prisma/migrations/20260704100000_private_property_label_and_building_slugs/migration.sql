-- Rename private property slugs: private-{city} -> private-property-{city}
UPDATE "projects"
SET "slug" = lower(
  trim(both '-' from regexp_replace(
    concat('private-property-', coalesce("city", '')),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ))
)
WHERE "is_private_on_website" = true
  AND coalesce("city", '') <> '';

UPDATE "projects"
SET "slug" = regexp_replace("slug", '^private-', 'private-property-')
WHERE "is_private_on_website" = true
  AND "slug" LIKE 'private-%'
  AND "slug" NOT LIKE 'private-property-%';

ALTER TABLE "buildings" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "buildings_slug_key" ON "buildings"("slug");

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "buildings"
SET "slug" = substring(encode(digest('building:' || "id"::text, 'sha256'), 'hex'), 1, 8)
WHERE "is_whole_property_listing" = true;
