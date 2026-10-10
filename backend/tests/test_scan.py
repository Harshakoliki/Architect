import io
import json
import stat
import zipfile
from uuid import uuid4

import httpx
import pytest

from architect import db
from architect.archive import MAX_UPLOAD, unpack
from architect.scanner import ScanError, redact, scan


def archive(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as handle:
        for name, content in entries:
            handle.writestr(name, content)
    return output.getvalue()


def test_real_scan_ignore_privacy_and_frameworks(tmp_path):
    raw = archive([('repo/.gitignore', 'ignored.py\n'), ('repo/ignored.py', 'bad = 1'),
                   ('repo/.env', 'SECRET=never'), ('repo/node_modules/pkg/index.js', 'never'),
                   ('repo/web/app.tsx', 'export const App = () => null;'),
                   ('repo/package.json', '{"dependencies":{"react":"19"}}')])
    root, skipped = unpack(raw, tmp_path)
    files, summary = scan(root)
    assert {file['path'] for file in files} == {'web/app.tsx', 'package.json'}
    assert summary['frameworks'] == ['React']
    assert summary['skip_reasons']['Git ignore rule'] == 1
    assert len(skipped) == 2
    assert not (tmp_path / 'repo/.env').exists()


@pytest.mark.parametrize('path', ['../escape.py', '/absolute.py', 'a/../../escape.py',
                                  'C:/escape.py', 'a\\escape.py'])
def test_reject_unsafe_zip_paths(path, tmp_path):
    with pytest.raises(ScanError, match='unsafe'):
        unpack(archive([(path, 'source')]), tmp_path)


def test_reject_zip_symlink_and_expansion(tmp_path):
    info = zipfile.ZipInfo('link.py')
    info.create_system = 3
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    with pytest.raises(ScanError, match='Symbolic'):
        unpack(archive([(info, '/etc/passwd')]), tmp_path)
    with pytest.raises(ScanError, match='20 MiB'):
        unpack(archive([('huge.py', b'a' * (21 * 1024 * 1024))]), tmp_path)
    with pytest.raises(ScanError, match='3 MiB'):
        unpack(b'x' * (MAX_UPLOAD + 1), tmp_path)


def test_invalid_zip_and_duplicate_paths(tmp_path):
    with pytest.raises(ScanError, match='could not be read'):
        unpack(b'not a zip', tmp_path)
    with pytest.warns(UserWarning):
        raw = archive([('same.py', 'one'), ('same.py', 'two')])
    with pytest.raises(ScanError, match='duplicate'):
        unpack(raw, tmp_path)


def test_redaction_preserves_line_positions():
    source = 'api_key = "secret-value"\nkey="sk-abcdefghijklmno"\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\nlast=1'
    masked = redact(source)
    assert 'secret-value' not in masked and 'sk-abcdefgh' not in masked and 'abc' not in masked
    assert len(masked.splitlines()) == len(source.splitlines())


def test_sample_and_uploaded_captured_source(client):
    response = client.post('/api/sample')
    events = [json.loads(line) for line in response.text.splitlines()]
    project = events[-1]['project']
    assert project['summary']['frameworks'] == ['FastAPI', 'Next.js', 'React']
    assert project['summary']['file_count'] >= 6
    assert not project['persisted']
    raw = archive([('src/main.py', 'api_key="hidden-value"\nprint(1)')])
    response = client.post('/api/scan', content=raw, headers={'content-type': 'application/zip'})
    project = json.loads(response.text.splitlines()[-1])['project']
    assert 'hidden-value' not in json.dumps(project)
    assert project['files'][0]['path'] == 'main.py'  # A sole archive wrapper is normalized away.
    assert 'REDACTED' in next(iter(project['contents'].values()))
    assert client.get('/api/projects').json() == []


def test_boundaries(client):
    assert client.get('/api/health', headers={'x-architect-secret': 'wrong'}).status_code == 403
    assert client.get('/api/health', headers={'x-architect-workspace': '../bad'}).status_code == 403
    assert client.post('/api/scan', content='bad').status_code == 415
    assert client.get('/api/projects/not-a-uuid').status_code == 422
    assert client.get(f'/api/projects/{uuid4()}').status_code == 404
    result = client.post('/api/scan', content=b'bad', headers={'content-type': 'application/zip'})
    assert json.loads(result.text.splitlines()[-1])['stage'] == 'error'


def test_supabase_scopes_every_read_and_no_secret_bearer(monkeypatch):
    seen = []
    def handler(request):
        seen.append(request)
        assert request.headers['apikey'] == 'sb_secret_test'
        assert 'authorization' not in request.headers
        assert request.url.params['workspace_id'] == 'eq.' + 'b' * 64
        return httpx.Response(200, json=[])
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_SECRET_KEY', 'sb_secret_test')
    original = httpx.Client
    monkeypatch.setattr(db.httpx, 'Client', lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(handler)))
    assert db.projects('b' * 64) == []
    assert db.load('b' * 64, str(uuid4())) is None
    assert len(seen) == 2


def test_failed_save_keeps_preview_and_hides_error(client, monkeypatch):
    monkeypatch.setattr(db, 'configured', lambda: True)
    def fail(*args):
        raise httpx.ConnectError('sensitive-internal-secret')
    monkeypatch.setattr(db, 'save', fail)
    response = client.post('/api/sample')
    assert 'sensitive-internal-secret' not in response.text
    project = json.loads(response.text.splitlines()[-1])['project']
    assert project['persisted'] is False and project['warning']


def test_json_secret_masking():
    assert redact('{"api_key": "hidden", "password": "also-hidden"}') == '{"api_key": "[REDACTED]", "password": "[REDACTED]"}'


def test_supabase_save_failure_removes_orphan(monkeypatch):
    methods = []
    def handler(request):
        methods.append(request.method)
        if '/rest/v1/' in request.url.path:
            return httpx.Response(500, json={'message': 'failure'})
        return httpx.Response(200, json={})
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_SECRET_KEY', 'sb_secret_test')
    original = httpx.Client
    monkeypatch.setattr(db.httpx, 'Client', lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(handler)))
    with pytest.raises(httpx.HTTPStatusError):
        db.save('c' * 64, {'id': str(uuid4()), 'name': 'test', 'summary': {}, 'files': []}, {})
    assert methods == ['POST', 'POST', 'DELETE']


def test_supabase_load_scopes_metadata_then_reads_private_capture(monkeypatch):
    import gzip
    workspace = 'd' * 64
    identifier = str(uuid4())
    def handler(request):
        if '/rest/v1/' in request.url.path:
            assert request.url.params['workspace_id'] == 'eq.' + workspace
            assert request.url.params['id'] == 'eq.' + identifier
            return httpx.Response(200, json=[{'id': identifier, 'workspace_id': workspace,
                'source_key': f'{workspace}/{identifier}.json.gz', 'files': []}])
        assert request.url.path == f'/storage/v1/object/architect-source/{workspace}/{identifier}.json.gz'
        return httpx.Response(200, content=gzip.compress(b'{"file-id":"captured source"}'))
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_SECRET_KEY', 'sb_secret_test')
    original = httpx.Client
    monkeypatch.setattr(db.httpx, 'Client', lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(handler)))
    project = db.load(workspace, identifier)
    assert project['persisted'] is True
    assert project['contents'] == {'file-id': 'captured source'}
    assert 'workspace_id' not in project and 'source_key' not in project


def test_updated_sample_endpoint_is_labeled_and_has_captured_source(client):
    response = client.post('/api/sample-next')
    assert response.status_code == 200
    project = json.loads(response.text.splitlines()[-1])['project']
    assert project['name'] == 'document-app · updated sample'
    assert project['sample'] is False  # The original annotated product interpretation must not attach.
    assert any(file['path'] == 'api/audit.py' for file in project['files'])
    assert '/api/documents/upload' in ''.join(project['contents'].values())
