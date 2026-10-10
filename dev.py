"""Start the browser app and analysis API with one command, after dependency setup."""
import os
import secrets
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    environment = os.environ.copy()
    envfile = ROOT / '.env'
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            key, separator, value = line.partition('=')
            if not separator or not key.strip().isidentifier():
                raise SystemExit('Invalid .env entry. Use KEY=value, one per line.')
            environment.setdefault(key.strip(), value.strip().strip('\"\''))
    environment.setdefault('ARCHITECT_SERVICE_SECRET', secrets.token_hex(32))
    environment.setdefault('ARCHITECT_BACKEND_URL', 'http://127.0.0.1:8000')
    python = ROOT / 'backend/.venv/bin/python'
    if not python.exists() or not (ROOT / 'frontend/node_modules').exists():
        raise SystemExit('Install dependencies first. See README.md → Quick start.')
    processes = []
    exit_code = 0
    try:
        processes.append(subprocess.Popen([str(python), '-m', 'uvicorn', 'main:app',
                                          '--host', '127.0.0.1', '--port', '8000'],
                                         cwd=ROOT / 'backend', env=environment, start_new_session=True))
        processes.append(subprocess.Popen(['npm', 'run', 'dev'], cwd=ROOT / 'frontend',
                                         env=environment, start_new_session=True))
        print('\nArchitect: http://127.0.0.1:3000\nPress Ctrl+C to stop both services.\n', flush=True)
        while all(process.poll() is None for process in processes):
            try:
                processes[0].wait(timeout=1)
            except subprocess.TimeoutExpired:
                pass
        exit_code = 1
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
