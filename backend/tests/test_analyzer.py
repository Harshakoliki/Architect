import hashlib
from pathlib import Path

from architect.analyzer import build_graph
from architect.main import SAMPLE
from architect.scanner import scan


def source(path, content):
    return {'id': hashlib.sha256(path.encode()).hexdigest()[:24], 'path': path,
            'language': 'Python' if path.endswith('.py') else 'TypeScript',
            'lines': len(content.splitlines()), 'hash': hashlib.sha256(content.encode()).hexdigest(),
            'content': content}


def test_sample_has_proven_storage_import_and_careful_http_candidate():
    files, _ = scan(SAMPLE)
    graph = build_graph(files)
    nodes = {node['id']: node for node in graph['nodes']}
    imported = [edge for edge in graph['edges'] if edge['kind'] == 'imports']
    assert len(imported) == 1
    assert nodes[imported[0]['source']]['label'] == 'api/main.py'
    assert nodes[imported[0]['target']]['label'] == 'api/storage.py'
    candidates = [edge for edge in graph['edges'] if edge['kind'] == 'http_candidate']
    assert len(candidates) == 1 and candidates[0]['confidence'] == 'inferred'
    assert [proof['path'] for proof in candidates[0]['evidence']] == ['web/upload.tsx','api/main.py']
    assert not any('schema.sql' in node['label'] for node in graph['nodes'])
    by_id = {file['id']: file for file in files}
    for edge in graph['edges']:
        for proof in edge['evidence']:
            assert proof['file_id'] in by_id
            assert 1 <= proof['start_line'] <= proof['end_line'] <= by_id[proof['file_id']]['lines']
            assert proof['source_hash'] == by_id[proof['file_id']]['hash']


def test_js_parser_ignores_comments_strings_and_resolves_multiline_imports():
    files = [source('src/main.ts', '''// import './fake';
const text = "import './also-fake'";
import {
  helper
} from './helpers';
export { value } from './values.js';
const common = require('./helpers');
import(computedPath);
import('@/alias');
'''), source('src/helpers/index.ts', 'export const helper = 1;'),
             source('src/values.ts', 'export const value = 2;')]
    graph = build_graph(files)
    labels = {node['label'] for node in graph['nodes']}
    assert './fake' not in labels and './also-fake' not in labels
    assert len([edge for edge in graph['edges'] if edge['kind'] == 'imports']) == 2
    assert any('Computed module' in gap['message'] for gap in graph['gaps'])
    assert any('@/alias' in gap['message'] for gap in graph['gaps'])
    # Explicit .js -> .ts substitution is not assumed until configured resolver support exists.
    assert any('./values.js' in gap['message'] for gap in graph['gaps'])


def test_python_routes_require_fastapi_factory_and_relative_import_missing_is_unknown():
    files = [source('api/main.py', '''from fastapi import FastAPI as API
from .missing import service
app = API()
@app.get('/items')
def items():
    return []
'''), source('fake.py', '''other = Something()
@other.post('/fake')
def fake(): pass
''')]
    graph = build_graph(files)
    assert [node['label'] for node in graph['nodes'] if node['kind'] == 'route'] == ['GET /items']
    unresolved = [edge for edge in graph['edges'] if edge['kind'] == 'unresolved']
    assert len(unresolved) == 1 and unresolved[0]['confidence'] == 'unknown'


def test_duplicate_route_or_computed_method_never_invents_http_link():
    files = [source('api.py', '''from fastapi import FastAPI
app = FastAPI()
@app.post('/same')
def first(): pass
@app.post('/same')
def second(): pass
'''), source('web.ts', '''fetch('/same', {method:'POST'});
fetch('/same', options);
fetch('/same', {method:'POST', ...options});
''')]
    graph = build_graph(files)
    assert not any(edge['kind'] == 'http_candidate' for edge in graph['edges'])
    assert len(graph['gaps']) == 3


def test_parse_failure_has_gap_and_cycles_have_valid_direction():
    files = [source('a.py', 'import b\n'), source('b.py', 'import a\n'),
             source('bad.py', 'def ('), source('bad.ts', 'import { from')]
    graph = build_graph(files)
    assert len(graph['gaps']) == 2
    assert len(graph['edges']) == 2
    assert {edge['source'] for edge in graph['edges']} == {files[0]['id'],files[1]['id']}
    assert {edge['target'] for edge in graph['edges']} == {files[0]['id'],files[1]['id']}


def test_current_real_repository_parses_and_all_references_point_into_capture():
    root = Path(__file__).resolve().parents[2]
    files, _ = scan(root)
    graph = build_graph(files)
    assert graph['parsed_files'] >= 10
    ids = {file['id'] for file in files}
    nodes = {node['id'] for node in graph['nodes']}
    assert all(edge['source'] in nodes and edge['target'] in nodes for edge in graph['edges'])
    assert all(proof['file_id'] in ids for edge in graph['edges'] for proof in edge['evidence'])


def test_plain_json_alias_and_next_app_route_conventions():
    import json
    files = [source('web/package.json', '{"dependencies":{"next":"16"}}'),
        source('web/tsconfig.json', json.dumps({'compilerOptions': {'paths': {'@/*':['./*']}}})),
        source('web/app/(product)/page.tsx', "import {helper} from '@/lib/helper'; export default function Page(){return <h1/>;}"),
        source('web/lib/helper.ts', 'export const helper = 1;'),
        source('web/app/api/items/route.ts', 'export async function GET(){return Response.json([]);}'),
        source('outside/app/api/fake/route.ts', 'export function GET(){return null;}')]
    graph = build_graph(files)
    labels = {node['label'] for node in graph['nodes'] if node['kind'] == 'route'}
    assert labels == {'PAGE /', 'GET /api/items'}
    imports = [edge for edge in graph['edges'] if edge['kind'] == 'imports']
    assert len(imports) == 1
    assert imports[0]['target'] == files[3]['id']


def test_updated_sample_scans_real_changes_and_retains_revision_evidence():
    original, _ = scan(SAMPLE)
    updated, _ = scan(SAMPLE.parent / 'document-app-v2')
    old = {file['path']: file for file in original}
    new = {file['path']: file for file in updated}
    assert set(new) - set(old) == {'api/audit.py'}
    assert set(old) - set(new) == {'database/schema.sql'}
    assert {path for path in old.keys() & new.keys() if old[path]['hash'] != new[path]['hash']} == {
        'api/main.py', 'web/upload.tsx', 'README.md'}
    graph = build_graph(updated)
    assert [node['label'] for node in graph['nodes'] if node['kind'] == 'route'] == ['POST /api/documents/upload']
    assert len([edge for edge in graph['edges'] if edge['kind'] == 'imports']) == 2
    for edge in graph['edges']:
        for evidence in edge['evidence']:
            assert evidence['source_hash'] == new[evidence['path']]['hash']
            assert 1 <= evidence['start_line'] <= evidence['end_line'] <= new[evidence['path']]['lines']
