from pathlib import Path
import json
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        work = tempfile.TemporaryDirectory()
        self.addCleanup(work.cleanup)
        self.base = Path(work.name)

    def fixture(self):
        root = self.base / "repo"
        root.mkdir(exist_ok=True)
        for name in ("scripts", "skills", ".agents", ".github", "schemas", "docs"):
            shutil.copytree(ROOT / name, root / name, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns("__pycache__"))
        # Catalog tests need declared paths, not a copy of the runtime or node_modules.
        catalog = json.loads((ROOT / "skills/catalog.json").read_text(encoding="utf-8"))
        for service in catalog["services"]:
            for name in service["entrypoints"] + service["contracts"]:
                target = root / name
                if not target.exists():
                    target.parent.mkdir(exist_ok=True, parents=True)
                    target.touch()
        return root
