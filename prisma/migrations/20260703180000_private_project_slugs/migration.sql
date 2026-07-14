-- Use "private-{city}" slugs for properties marked private on the website.

UPDATE "projects"
SET "slug" = lower(
  trim(both '-' from regexp_replace(
    concat('private-', coalesce("city", '')),
    '[^a-zA-Z0-9]+',
    '-',
    'g'
  ))
)
WHERE "is_private_on_website" = true
  AND coalesce("city", '') <> '';
