ALTER TABLE "FirmSettings" ADD COLUMN "groupTimingEnabled" BOOLEAN NOT NULL DEFAULT true;
-- Existing databases keep prior values unless explicitly updated.
-- Set aging inclusion default for existing rows if null/default behavior is needed by app logic.

