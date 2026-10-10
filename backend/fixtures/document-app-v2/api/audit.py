# Analysis fixture: records upload events in memory; no external service.
EVENTS = []

def record_upload(document_id: str):
    EVENTS.append({'event': 'document_uploaded', 'document_id': document_id})
