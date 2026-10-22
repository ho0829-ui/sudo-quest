import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.community.examples import EXAMPLE_POSTS
from app.community.schema import SCHEMA_VERSION
from app.community.seed import count_examples, remove_examples, seed_examples
from app.community.store import CommunityStore
from app.config import Settings
from app.main import create_app

NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)
CATEGORIES = {"question", "tip", "review", "free"}


class ExamplePostTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "community.sqlite3"
        self.store = CommunityStore(self.path)
        self.client = TestClient(create_app(Settings(community_db_path=self.path, chroma_path=Path(self.temp.name) / "chroma")))
        self.addCleanup(self.client.close)

    def test_example_data_is_well_formed(self):
        self.assertGreaterEqual(len(EXAMPLE_POSTS), 15)
        self.assertGreaterEqual(len({p["author"] for p in EXAMPLE_POSTS}), 8)
        for post in EXAMPLE_POSTS:
            self.assertIn(post["category"], CATEGORIES)
            self.assertTrue(0 < len(post["title"]) <= 120 and post["body"].strip() and post["author"].strip())
            self.assertTrue(0 <= post["days"] <= 30 and 0 <= post["hour"] <= 23)
            # 실습 회고는 풀이 포함으로 표시한다(목록 미리보기가 가려진다).
            if post["category"] == "review" and "실습" in post["title"] and "클리어" not in post["title"]:
                self.assertTrue(post.get("spoiler"), post["title"])

    def test_seed_once_and_shown_as_examples_newest_first(self):
        self.assertEqual(seed_examples(self.store, NOW), len(EXAMPLE_POSTS))
        self.assertEqual(seed_examples(self.store, NOW), 0)
        page = self.client.get("/api/community/posts", params={"page_size": 50}).json()
        self.assertEqual(page["total"], len(EXAMPLE_POSTS))
        self.assertTrue(all(item["example"] for item in page["items"]))
        dates = [item["created_at"] for item in page["items"]]
        self.assertEqual(dates, sorted(dates, reverse=True))
        self.assertTrue(all(datetime.fromisoformat(d) <= NOW for d in dates))
        first = page["items"][0]
        detail = self.client.get(f"/api/community/posts/{first['id']}").json()
        self.assertTrue(detail["example"])
        self.assertFalse(detail["deletable"])
        spoiler = next(item for item in page["items"] if item["spoiler"])
        self.assertEqual(spoiler["excerpt"], "")

    def test_example_comments_and_people_posts(self):
        seed_examples(self.store, NOW)
        created = self.client.post("/api/community/posts", json={"title": "진짜 글", "body": "본문", "author": "사람", "category": "free"}).json()
        self.assertFalse(created["example"])
        with_comments = next(i for i in self.client.get("/api/community/posts", params={"page_size": 50}).json()["items"] if i["comment_count"])
        comments = self.client.get(f"/api/community/posts/{with_comments['id']}/comments").json()["items"]
        self.assertTrue(comments and all(c["example"] for c in comments))

        self.assertEqual(remove_examples(self.store), len(EXAMPLE_POSTS))
        self.assertEqual(count_examples(self.store), 0)
        left = self.client.get("/api/community/posts").json()["items"]
        self.assertEqual([item["title"] for item in left], ["진짜 글"])

    def test_old_v2_file_is_upgraded_with_example_column(self):
        db = sqlite3.connect(self.path)
        db.executescript("""CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
            author TEXT NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL, spoiler INTEGER NOT NULL DEFAULT 0, delete_hash TEXT);
            CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, body TEXT NOT NULL,
            author TEXT NOT NULL, created_at TEXT NOT NULL, delete_hash TEXT);
            INSERT INTO posts(title, body, author, category, created_at) VALUES ('옛 글', '본문', '사람', 'free', '2026-10-01T00:00:00+00:00');
            PRAGMA user_version = 2;""")
        db.close()
        item = self.client.get("/api/community/posts").json()["items"][0]
        self.assertEqual((item["title"], item["example"]), ("옛 글", False))
        with sqlite3.connect(self.path) as check:
            self.assertEqual(check.execute("PRAGMA user_version").fetchone()[0], SCHEMA_VERSION)


if __name__ == "__main__":
    unittest.main()
