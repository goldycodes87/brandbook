-- Retire the FDA bulk import from the drug picker (first pass).
--
-- scripts/import-fda-drugs.ts pulled 320 products and tried to read a
-- withdrawal statement out of each SPL label with:
--   /[^.]*(?:slaughter|milk|withdrawal)[^.]{0,200}\./gi
-- That matched the phrase "recalls-market-withdrawals" inside a navigation
-- URL on the page, so those rows got a fragment of scraped HTML as their
-- "withdrawal note" and kept withdrawal_days_meat at the column default of 0.
--
-- The products are not cattle drugs either -- homeopathic and supplement
-- listings like ADRENAL SARCODE and ADAPTOPATH. Left active they pollute the
-- picker a vet uses at the chute, and any one of them selected would stamp a
-- 0-day meat withdrawal with nothing behind it.
--
-- Deactivated rather than deleted: is_active already gates the picker, and
-- keeping the rows preserves the provenance of what was imported.
--
-- NOTE: matching on the scraped HTML caught only 241 of the 320. The next
-- migration finishes the job on ndc_code, which is the real discriminator.
update public.drug_library
set    is_active = false
where  is_active
  and  (notes ilike '%href=%' or notes ilike '%recalls-market-withdrawals%');
