import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.config import Settings, load_settings
from app.main import create_app
from app.community.store import CommunityStore, TooManyWrites

KEY = "test-moderation-key-never-use-in-production"
POST = {"title": "Nginx 조사 기록", "body": "curl 결과를 비교했어요.\nHTTP 502", "author": "운영자", "category": "question"}


class CommunityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "community.sqlite3"
        self.settings = Settings(community_db_path=self.path, community_admin_key=SecretStr(KEY), chroma_path=Path(self.temp.name) / "chroma")
        # 게시판은 RAG 수명주기/키/색인 없이 독립적으로 요청을 처리한다.
        self.client = TestClient(create_app(self.settings))
        self.addCleanup(self.client.close)
        self.headers = {"Authorization": f"Bearer {KEY}"}

    def post(self, **values):
        return self.client.post("/api/community/posts", json={**POST, **values})

    def test_empty_create_detail_and_persistence(self):
        self.assertEqual(self.client.get("/api/community/posts").json()["total"], 0)
        created = self.post()
        self.assertEqual(created.status_code, 201)
        item = created.json()
        self.assertEqual(self.client.get(f'/api/community/posts/{item["id"]}').json(), item)
        with TestClient(create_app(self.settings)) as restarted:
            self.assertEqual(restarted.get("/api/community/posts").json()["total"], 1)
        self.assertEqual(CommunityStore(self.path).detail(item["id"])["body"], POST["body"])

    def test_search_filter_and_pagination(self):
        for index in range(4):
            self.post(title=f"기록 {index}", category="tip" if index < 3 else "free")
        result = self.client.get("/api/community/posts?category=tip&page=2&page_size=2").json()
        self.assertEqual((result["total"], len(result["items"]), result["items"][0]["title"]), (3, 1, "기록 0"))
        self.assertEqual(self.client.get("/api/community/posts", params={"q": "502"}).json()["total"], 4)
        self.assertEqual(self.client.get("/api/community/posts?q=no-match").json()["total"], 0)

    def test_search_treats_wildcards_as_text_and_sql_as_data(self):
        self.post(title="100% _ 완료", body="'); DROP TABLE posts; --")
        self.post(title="다른 기록")
        for query in ("%", "_", "DROP TABLE"):
            self.assertEqual(self.client.get("/api/community/posts", params={"q": query}).json()["total"], 1)
        self.assertEqual(self.client.get("/api/community/posts", params={"q": "' OR 1=1 --"}).json()["total"], 0)
        self.assertEqual(self.client.get("/api/community/posts").json()["total"], 2)

    def test_comments_pagination_counts_and_cascade(self):
        post_id = self.post().json()["id"]
        for index in range(3):
            result = self.client.post(f"/api/community/posts/{post_id}/comments", json={"author": "동료", "body": f"댓글 {index}"})
            self.assertEqual(result.status_code, 201)
        result = self.client.get(f"/api/community/posts/{post_id}/comments?page=2&page_size=2").json()
        self.assertEqual((result["total"], result["items"][0]["body"]), (3, "댓글 2"))
        self.assertEqual(self.client.get("/api/community/posts").json()["items"][0]["comment_count"], 3)
        self.assertEqual(self.client.delete(f"/api/community/posts/{post_id}", headers=self.headers).status_code, 204)
        with CommunityStore(self.path).connection() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM comments").fetchone()[0], 0)

    def test_comment_deletion_requires_admin(self):
        post_id = self.post().json()["id"]
        item = self.client.post(f"/api/community/posts/{post_id}/comments", json={"author": "동료", "body": "안녕하세요"}).json()
        url = f'/api/community/comments/{item["id"]}'
        self.assertEqual(self.client.delete(url).status_code, 401)
        self.assertEqual(self.client.delete(url, headers=self.headers).status_code, 204)
        self.assertEqual(self.client.delete(url, headers=self.headers).status_code, 404)

    def test_post_deletion_auth_disabled_and_no_key_echo(self):
        post_id = self.post().json()["id"]
        url = f"/api/community/posts/{post_id}"
        for headers in ({}, {"Authorization": "Bearer wrong"}):
            result = self.client.delete(url, headers=headers)
            self.assertEqual(result.status_code, 401)
            self.assertNotIn(KEY, result.text)
        with TestClient(create_app(Settings(community_db_path=self.path, chroma_path=Path(self.temp.name) / "chroma"))) as disabled:
            self.assertEqual(disabled.delete(url, headers=self.headers).status_code, 503)
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_validation_trim_limits_and_no_reflection(self):
        for values in ({"title": "   "}, {"body": "\n "}, {"author": "x" * 25}, {"category": "unknown"},
                       {"title": "x" * 101}, {"body": "x" * 10001}, {"hidden": "secret"}):
            result = self.post(**values)
            self.assertEqual(result.status_code, 422, values.keys())
            self.assertNotIn("secret", result.text)
        self.assertEqual(self.post(title="  제목  ").json()["title"], "제목")
        result = self.client.post("/api/community/posts/1/comments", json={"author": "a", "body": "x" * 2001})
        self.assertEqual(result.status_code, 422)

    def test_invalid_query_and_ids(self):
        for suffix in ("?page=0", "?page_size=51", "?category=bad", "?q=" + "x" * 101,
                       "/0", "/999999999999999999999999", "/abc"):
            self.assertEqual(self.client.get("/api/community/posts" + suffix).status_code, 422)
        for suffix in ("/900", "/900/comments"):
            self.assertEqual(self.client.get("/api/community/posts" + suffix).status_code, 404)
        self.assertEqual(self.client.post("/api/community/posts/900/comments", json={"author": "a", "body": "b"}).status_code, 404)

    def test_rate_limit_persists_and_covers_comments(self):
        post_id = self.post().json()["id"]
        for _ in range(9):
            self.assertEqual(self.client.post(f"/api/community/posts/{post_id}/comments", json={"author": "a", "body": "b"}).status_code, 201)
        result = self.post()
        self.assertEqual(result.status_code, 429)
        self.assertEqual(result.headers["Retry-After"], "60")
        self.assertEqual(self.client.get("/api/community/posts").json()["total"], 1)
        with TestClient(create_app(self.settings)) as restarted:
            self.assertEqual(restarted.post("/api/community/posts", json=POST).status_code, 429)
        with patch("app.community.store.time.time", return_value=9999999999):
            self.assertEqual(self.post().status_code, 201)

    def test_parallel_writes_cannot_bypass_limit(self):
        def create(_):
            try:
                CommunityStore(self.path).create_post(POST, "shared-client")
                return True
            except TooManyWrites:
                return False
        with ThreadPoolExecutor(max_workers=8) as pool:
            outcomes = list(pool.map(create, range(20)))
        self.assertEqual(sum(outcomes), 10)
        self.assertEqual(self.client.get("/api/community/posts").json()["total"], 10)

    def test_origin_and_forwarded_header(self):
        result = self.client.post("/api/community/posts", json=POST, headers={"Origin": "https://evil.example"})
        self.assertEqual(result.status_code, 403)
        for i in range(10):
            self.assertEqual(self.client.post("/api/community/posts", json=POST, headers={"Origin": "http://127.0.0.1:5173", "X-Forwarded-For": f"192.0.2.{i}"}).status_code, 201)
        self.assertEqual(self.post().status_code, 429)

    def test_settings_paths_and_minimum_key(self):
        with patch("app.config.load_dotenv"), patch.dict("os.environ", {"COMMUNITY_DB_PATH": "data/test.sqlite3"}, clear=True):
            self.assertTrue(load_settings().community_db_path.is_absolute())
        with self.assertRaises(ValidationError):
            Settings(community_admin_key=SecretStr("short"))
