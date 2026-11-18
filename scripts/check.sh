#!/bin/sh
set -eu
cd "$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
"${PYTHON:-python3}" scripts/check_repository.py
"${PYTHON:-python3}" scripts/check_links.py
"${PYTHON:-python3}" scripts/check_docs_impact.py
"${PYTHON:-python3}" -m unittest discover -s tests -v
npm test
