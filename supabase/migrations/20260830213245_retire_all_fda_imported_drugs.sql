-- Finish retiring the FDA bulk import.
--
-- The previous migration matched on scraped HTML in `notes` and caught 241 of
-- the 320 imported rows; 79 slipped through with cleaner notes (ALOE-PLEX,
-- BARRIER-DINE, an allergen-extract listing running to 500 characters of
-- product name). Matching on the artefact of the scrape was the wrong test.
--
-- ndc_code is the real discriminator, and it is exact:
--   319 of 320 imported rows carry one; not one of the 36 curated rows does.
-- The curated set is also the only one with dosage_info and route filled in,
-- which is what the chute-side picker actually needs.
--
-- What remains active afterwards is a 37-product cattle formulary: 20 with a
-- real meat withdrawal (Dectomax Pour-On 45d, Nuflor 38d, Ivomec 35d,
-- LA-200 28d, Draxxin 18d, Excede 13d, Penicillin G 10d, Safe-Guard 8d,
-- Banamine 4d ...) and 17 legitimately at zero -- vaccines (Bovi-Shield,
-- Vista 5, Pyramid 5), hormones (Lutalyse, Estrumate, Oxytocin), supplements,
-- and products whose label states no withdrawal (Cydectin Pour-On,
-- Excenel RTU).
--
-- Deactivated, not deleted: is_active gates the picker and the rows keep the
-- provenance of what was imported.
update public.drug_library
set    is_active = false
where  is_active
  and  ndc_code is not null;

-- The single imported row with no NDC is the allergen-extract listing whose
-- "brand name" is a 500-character run of species epithelium products. Nothing
-- a cow vet would ever reach for.
update public.drug_library
set    is_active = false
where  is_active
  and  dosage_info is null
  and  brand_name = upper(brand_name)
  and  length(brand_name) > 60;
