-- Proposed persistence schema. The sample currently uses in-memory storage.
-- This table is not connected to api/storage.py.
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
