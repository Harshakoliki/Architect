import { useState } from 'react';

// Analysis fixture only: not an independently runnable application.
export function DocumentUpload() {
  const [message, setMessage] = useState('');
  async function upload(file: File) {
    const body = new FormData();
    body.append('document', file);
    const response = await fetch('/api/documents/upload', { method: 'POST', body });
    setMessage(response.ok ? 'Document uploaded' : 'Upload failed');
  }
  return <section><h1>Upload a document</h1>
    <input aria-label="Document" type="file" onChange={event => {
      const file = event.target.files?.[0];
      if (file) void upload(file);
    }}/><p>{message}</p></section>;
}
