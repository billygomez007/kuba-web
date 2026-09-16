ALTER TABLE tasks ADD deal_id text;
ALTER TABLE appointments ADD deal_id text;
CREATE INDEX tasks_business_deal_idx ON tasks(business_id, deal_id);
CREATE INDEX appointments_business_deal_idx ON appointments(business_id, deal_id);
