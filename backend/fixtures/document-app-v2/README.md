# Document app — second analysis fixture

This source-only fixture is not a runnable product. Compared with document-app,
the upload endpoint moves to /api/documents/upload, the frontend uses the new
path, an in-memory audit module is added and imported, and the unconnected SQL
schema is removed. No repository code is executed when Architect scans it.
