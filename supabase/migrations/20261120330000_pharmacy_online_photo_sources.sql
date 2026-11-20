-- Preserve source and attribution metadata for pharmacist-reviewed online image suggestions.
alter table public.pharmacy_catalogue_photo_suggestions
  add column if not exists source_page_url text,
  add column if not exists source_image_url text,
  add column if not exists source_license text,
  add column if not exists source_artist text,
  add column if not exists source_license_url text;

alter table public.pharmacy_catalogue_photo_suggestions
  add constraint pharmacy_photo_source_page_url_check
    check (source_page_url is null or source_page_url ~ '^https?://'),
  add constraint pharmacy_photo_source_image_url_check
    check (source_image_url is null or source_image_url ~ '^https?://'),
  add constraint pharmacy_photo_source_license_url_check
    check (source_license_url is null or source_license_url ~ '^https?://');
