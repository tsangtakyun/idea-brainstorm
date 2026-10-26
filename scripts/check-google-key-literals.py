#!/usr/bin/env python3
"""Fail on Google API key literals without printing credential values."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
staged = '--staged' in sys.argv
pattern = re.compile(rb'AIza[0-9A-Za-z_-]{35}')
files = subprocess.check_output(
    ['git', '-C', str(root), 'ls-files', '-z']).split(b'\0')
findings = 0
for raw in files:
    if not raw:
        continue
    path = raw.decode()
    if staged:
        result = subprocess.run(['git', '-C', str(root), 'show', ':' + path],
                                capture_output=True)
        data = result.stdout if result.returncode == 0 else b''
    else:
        file = root / path
        data = file.read_bytes() if file.is_file() else b''
    for match in pattern.finditer(data):
        findings += 1
        print(json.dumps({'path': path,
                          'line': data[:match.start()].count(b'\n') + 1,
                          'sha256_prefix': hashlib.sha256(match.group()).hexdigest()[:16]}))
print(json.dumps({'google_key_literal_count': findings, 'staged': staged}))
sys.exit(1 if findings else 0)
