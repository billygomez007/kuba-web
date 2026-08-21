ALTER TABLE skills ADD COLUMN publisher text DEFAULT 'Kuba' NOT NULL;

ALTER TABLE skills ADD COLUMN icon text;

ALTER TABLE skills ADD COLUMN is_marketplace integer DEFAULT 1 NOT NULL;

ALTER TABLE skills ADD COLUMN price integer DEFAULT 0 NOT NULL;

ALTER TABLE skills ADD COLUMN rating integer DEFAULT 5 NOT NULL;

ALTER TABLE skills ADD COLUMN install_count integer DEFAULT 0 NOT NULL;
