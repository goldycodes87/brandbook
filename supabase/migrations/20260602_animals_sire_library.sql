alter table animals add column if not exists sire_library_id uuid references sire_library(id);

notify pgrst, 'reload schema';
