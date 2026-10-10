from fastapi import FastAPI, UploadFile
from .storage import save_document

app = FastAPI()

@app.post('/api/documents')
async def upload_document(document: UploadFile):
    content = await document.read()
    identifier = save_document(document.filename, content)
    return {'document_id': identifier, 'status': 'stored'}
