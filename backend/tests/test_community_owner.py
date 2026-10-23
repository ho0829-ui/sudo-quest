"""게시판 2단계: 작성자 삭제 비밀번호, 풀이 포함 표시, 운영자 키 확인, 기존 데이터 파일 버전 올리기."""
import sqlite3
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings
from app.main import create_app
from app.community.schema import BASE, SCHEMA_VERSION

KEY = "test-moderation-key-never-use-in-production"
PASSWORD = "cafe-4321"
POST = {"title": "회고", "body": "원인은 디스크였어요.", "author": "운영자", "category": "review"}


class CommunityOwnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "community.sqlite3"
        self.settings = Settings(community_db_path=self.path, community_admin_key=SecretStr(KEY),
                                 chroma_path=Path(self.temp.name) / "chroma")
        self.client = TestClient(create_app(self.settings))
        self.addCleanup(self.client.close)

    def create(self, **values):
        result = self.client.post("/api/community/posts", json={**POST, **values})
        self.assertEqual(result.status_code, 201, result.text)
        return result.json()

    def test_password_is_hashed_and_never_returned(self):
        item = self.create(password=PASSWORD)
        self.assertTrue(item["deletable"])
        comment = self.client.post(f'/api/community/posts/{item["id"]}/comments',
                                   json={"author": "동료", "body": "공감해요", "password": PASSWORD}).json()
        self.assertTrue(comment["deletable"])
        responses = [self.client.get("/api/community/posts").text, self.client.get(f'/api/community/posts/{item["id"]}').text,
                     self.client.get(f'/api/community/posts/{item["id"]}/comments').text, str(item), str(comment)]
        for text in responses:
            for secret in (PASSWORD, "delete_hash", "scrypt"):
                self.assertNotIn(secret, text)
        with sqlite3.connect(self.path) as db:
            stored = db.execute("SELECT delete_hash FROM posts").fetchone()[0]
        self.assertTrue(stored.startswith("scrypt$"))
        self.assertNotIn(PASSWORD, stored)

    def test_author_can_delete_post_with_password_only(self):
        item = self.create(password=PASSWORD)
        url = f'/api/community/posts/{item["id"]}'
        self.client.post(f"{url}/comments", json={"author": "동료", "body": "댓글"})
        wrong = self.client.post(f"{url}/delete", json={"password": "nope-nope"})
        self.assertEqual((wrong.status_code, wrong.json()["detail"]), (403, "wrong_password"))
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(f"{url}/delete", json={"password": PASSWORD}).status_code, 204)
        self.assertEqual(self.client.get(url).status_code, 404)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM comments").fetchone()[0], 0)

    def test_without_password_only_admin_can_delete(self):
        item = self.create()
        self.assertFalse(item["deletable"])
        url = f'/api/community/posts/{item["id"]}'
        result = self.client.post(f"{url}/delete", json={"password": "anything"})
        self.assertEqual((result.status_code, result.json()["detail"]), (403, "author_delete_disabled"))
        self.assertEqual(self.client.delete(url, headers={"Authorization": f"Bearer {KEY}"}).status_code, 204)

    def test_author_can_delete_comment(self):
        post_id = self.create()["id"]
        comment = self.client.post(f"/api/community/posts/{post_id}/comments",
                                   json={"author": "동료", "body": "댓글", "password": PASSWORD}).json()
        url = f'/api/community/comments/{comment["id"]}/delete'
        self.assertEqual(self.client.post(url, json={"password": "wrong-one"}).status_code, 403)
        self.assertEqual(self.client.post(url, json={"password": PASSWORD}).status_code, 204)
        self.assertEqual(self.client.post(url, json={"password": PASSWORD}).status_code, 404)
        self.assertEqual(self.client.get(f"/api/community/posts/{post_id}/comments").json()["total"], 0)

    def test_wrong_password_attempts_count_toward_rate_limit(self):
        item = self.create(password=PASSWORD)  # 작성 1회
        url = f'/api/community/posts/{item["id"]}/delete'
        for _ in range(9):
            self.assertEqual(self.client.post(url, json={"password": "guess-0000"}).status_code, 403)
        # 틀린 시도가 되돌려지지 않고 쌓였으므로 맞는 비밀번호도 1분 동안은 막힌다.
        self.assertEqual(self.client.post(url, json={"password": PASSWORD}).status_code, 429)
        self.assertEqual(self.client.get(f'/api/community/posts/{item["id"]}').status_code, 200)

    def test_spoiler_hides_list_excerpt_but_keeps_detail(self):
        item = self.create(spoiler=True)
        self.create(title="일반 글", category="question")
        listed = {post["title"]: post for post in self.client.get("/api/community/posts").json()["items"]}
        self.assertEqual((listed["회고"]["spoiler"], listed["회고"]["excerpt"]), (True, ""))
        self.assertEqual((listed["일반 글"]["spoiler"], listed["일반 글"]["excerpt"]), (False, POST["body"]))
        self.assertEqual(self.client.get(f'/api/community/posts/{item["id"]}').json()["body"], POST["body"])

    def test_admin_check_endpoint(self):
        self.assertEqual(self.client.get("/api/community/admin", headers={"Authorization": f"Bearer {KEY}"}).status_code, 204)
        result = self.client.get("/api/community/admin", headers={"Authorization": "Bearer wrong"})
        self.assertEqual(result.status_code, 401)
        self.assertNotIn(KEY, result.text)
        with TestClient(create_app(Settings(community_db_path=self.path, chroma_path=Path(self.temp.name) / "c"))) as off:
            self.assertEqual(off.get("/api/community/admin", headers={"Authorization": f"Bearer {KEY}"}).status_code, 503)

    def test_short_password_rejected_without_echo(self):
        result = self.client.post("/api/community/posts", json={**POST, "password": "abc"})
        self.assertEqual(result.status_code, 422)
        self.assertNotIn("abc", result.text.replace("invalid_request", ""))

    def test_version_one_file_is_upgraded_in_place(self):
        # 1단계 스키마로 만든 기존 파일(글 1개)을 새 서버가 열면 열을 더하고 글을 그대로 보여 준다.
        with sqlite3.connect(self.path) as db:
            db.executescript(BASE)
            db.execute("INSERT INTO posts(title, body, author, category, created_at) VALUES ('옛 글', '본문', '나', 'free', '2026-10-22T00:00:00+00:00')")
        with TestClient(create_app(self.settings)) as upgraded:
            listed = upgraded.get("/api/community/posts").json()["items"]
            self.assertEqual((listed[0]["title"], listed[0]["spoiler"]), ("옛 글", False))
            self.assertFalse(upgraded.get(f'/api/community/posts/{listed[0]["id"]}').json()["deletable"])
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], SCHEMA_VERSION)
