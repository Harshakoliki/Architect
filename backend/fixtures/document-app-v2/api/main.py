from fastapi import FastAPI, UploadFile
from .storage import save_document
from .audit import record_upload

app = FastAPI()

@app.post('/api/documents/upload')
async def upload_document(document: UploadFile):
    content = await document.read()
    identifier = save_document(document.filename, content)
    record_upload(identifier)
    return {'document_id': identifier, 'status': 'stored'}
