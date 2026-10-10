import hashlib

# Analysis fixture: a deliberately simple in-memory storage boundary.
DOCUMENTS = {}

def save_document(name: str, content: bytes) -> str:
    identifier = hashlib.sha256(content).hexdigest()[:16]
    DOCUMENTS[identifier] = {'name': name, 'content': content}
    return identifier
