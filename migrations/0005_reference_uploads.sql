ALTER TABLE uploads ADD COLUMN media_kind TEXT CHECK(media_kind IN ('audio','video'));
ALTER TABLE uploads ADD COLUMN duration REAL;
ALTER TABLE uploads ADD COLUMN width INTEGER;
ALTER TABLE uploads ADD COLUMN height INTEGER;
ALTER TABLE uploads ADD COLUMN has_audio INTEGER CHECK(has_audio IN (0,1));
