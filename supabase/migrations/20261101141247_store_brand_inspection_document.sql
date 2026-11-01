-- The brand inspection certificate is a legal record of ownership and of the
-- animal's right to move. The new-animal form has asked for it since the
-- beginning and never stored it: the handler made a blob URL for the preview
-- and nothing else, so every certificate uploaded so far was discarded when
-- the page closed.
--
-- One column, holding the R2 URL of the original file. The original, not a
-- resized copy -- a brand inspection is read by a brand inspector or a sheriff,
-- not by a phone screen, so it goes up at whatever resolution the camera gave
-- us. It is uploaded straight to R2 rather than through a function, which is
-- what makes that possible.
alter table animals
  add column if not exists brand_inspection_url text;

comment on column animals.brand_inspection_url is
  'R2 URL of the brand inspection certificate (image or PDF), stored at original resolution.';
