import sys
from pathlib import Path

import pytest

# Ensure project root is importable when running pytest from subdirectories
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import app
import modules.db as db


@pytest.fixture
def client(tmp_path, monkeypatch):
    """
    Provide a Flask test client wired to an isolated SQLite database.
    Each test gets a fresh database file to avoid cross-test leakage.
    """
    test_db = tmp_path / "test.db"
    monkeypatch.setattr(db, "DATABASE_PATH", str(test_db))

    db.init_database()
    app.app.config["TESTING"] = True

    with app.app.test_client() as client:
        yield client
