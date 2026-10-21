"""게시판 전용 저장소. 게임 상태·RAG 색인과 분리된 실제 SQLite 데이터다."""
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import sqlite3
import threading
import time

from app.community.passwords import hash_password, verify_password
from app.community.schema import COMMENT_COLUMNS, POST_COLUMNS, prepare

WRITES_PER_MINUTE = 10


class TooManyWrites(Exception):
    pass


class MissingPost(Exception):
    pass


class MissingComment(Exception):
    pass


class WrongPassword(Exception):
    pass


class AuthorDeleteDisabled(Exception):
    """비밀번호 없이 쓴 글·댓글. 관리자만 지울 수 있다."""


def _post(row) -> dict:
    item = dict(row)
    for flag in ("spoiler", "deletable"):
        if flag in item:
            item[flag] = bool(item[flag])
    return item


class CommunityStore:
    def __init__(self, path: Path):
        self.path = path
        self._prepared = False
        self._lock = threading.Lock()

    @contextmanager
    def connection(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA foreign_keys = ON")
            # 스키마 확인·버전 올리기는 저장소마다 한 번만 한다.
            with self._lock:
                if not self._prepared:
                    prepare(db)
                    self._prepared = True
            with db:
                yield db
        finally:
            db.close()

    def _rate_limit(self, db, client: str):
        # 프록시 전달 헤더는 신뢰하지 않는다. 카운터와 쓰기는 같은 트랜잭션이다.
        now = time.time()
        key = sha256(client.encode()).hexdigest()
        db.execute("DELETE FROM write_limits WHERE started <= ?", (now - 60,))
        row = db.execute("SELECT count FROM write_limits WHERE client = ?", (key,)).fetchone()
        if row and row["count"] >= WRITES_PER_MINUTE:
            raise TooManyWrites()
        db.execute("""INSERT INTO write_limits VALUES (?, ?, 1)
                      ON CONFLICT(client) DO UPDATE SET count = count + 1""", (key, now))

    def list_posts(self, category: str | None, query: str, page: int, page_size: int):
        where, args = [], []
        if category:
            where.append("p.category = ?")
            args.append(category)
        if query:
            # LIKE 특수문자도 검색 문자열 그대로 취급한다.
            pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            where.append("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')")
            args.extend([pattern, pattern])
        clause = " WHERE " + " AND ".join(where) if where else ""
        with self.connection() as db:
            db.execute("BEGIN")
            total = db.execute("SELECT count(*) FROM posts p" + clause, args).fetchone()[0]
            # 풀이가 담긴 글은 목록에서 본문 미리보기를 내보내지 않는다(실습 전 스포일러 방지).
            rows = db.execute("""SELECT p.id, p.title, p.author, p.category, p.created_at, p.spoiler,
                CASE WHEN p.spoiler THEN '' ELSE substr(p.body, 1, 160) END AS excerpt,
                (SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
                FROM posts p""" + clause + " ORDER BY p.id DESC LIMIT ? OFFSET ?",
                [*args, page_size, (page - 1) * page_size]).fetchall()
            return {"items": [_post(row) for row in rows], "total": total, "page": page, "page_size": page_size}

    def detail(self, post_id: int):
        with self.connection() as db:
            row = db.execute(f"SELECT {POST_COLUMNS} FROM posts WHERE id = ?", (post_id,)).fetchone()
            if not row:
                raise MissingPost()
            return _post(row)

    def comments(self, post_id: int, page: int, page_size: int):
        with self.connection() as db:
            db.execute("BEGIN")
            if not db.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone():
                raise MissingPost()
            total = db.execute("SELECT count(*) FROM comments WHERE post_id = ?", (post_id,)).fetchone()[0]
            rows = db.execute(f"SELECT {COMMENT_COLUMNS} FROM comments WHERE post_id = ? ORDER BY id LIMIT ? OFFSET ?",
                              (post_id, page_size, (page - 1) * page_size)).fetchall()
            return {"items": [_post(row) for row in rows], "total": total, "page": page, "page_size": page_size}

    def create_post(self, values: dict, client: str):
        # 해시는 수십 ms 걸리므로 쓰기 잠금을 잡기 전에 만든다.
        delete_hash = hash_password(values["password"]) if values.get("password") else None
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self._rate_limit(db, client)
            cursor = db.execute("""INSERT INTO posts(title, body, author, category, spoiler, delete_hash, created_at)
                                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                                (values["title"], values["body"], values["author"], values["category"],
                                 int(bool(values.get("spoiler"))), delete_hash, self._now()))
            return _post(db.execute(f"SELECT {POST_COLUMNS} FROM posts WHERE id = ?", (cursor.lastrowid,)).fetchone())

    def create_comment(self, post_id: int, values: dict, client: str):
        delete_hash = hash_password(values["password"]) if values.get("password") else None
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone():
                raise MissingPost()
            self._rate_limit(db, client)
            cursor = db.execute("INSERT INTO comments(post_id, body, author, delete_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                                (post_id, values["body"], values["author"], delete_hash, self._now()))
            return _post(db.execute(f"SELECT {COMMENT_COLUMNS} FROM comments WHERE id = ?", (cursor.lastrowid,)).fetchone())

    def delete(self, kind: str, item_id: int):
        """관리자 삭제. 테이블명은 라우터가 정한 상수만 허용한다."""
        if kind not in ("posts", "comments"):
            raise ValueError("invalid_table")
        with self.connection() as db:
            return db.execute(f"DELETE FROM {kind} WHERE id = ?", (item_id,)).rowcount > 0

    def delete_by_author(self, kind: str, item_id: int, password: str, client: str):
        """작성자 삭제. 시도마다 작성 속도 제한을 한 번 쓴다(비밀번호 대입을 1분 10회로 묶는다)."""
        if kind not in ("posts", "comments"):
            raise ValueError("invalid_table")
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self._rate_limit(db, client)
            row = db.execute(f"SELECT delete_hash FROM {kind} WHERE id = ?", (item_id,)).fetchone()
            if not row:
                outcome = "missing"
            elif row["delete_hash"] is None:
                outcome = "disabled"
            else:
                outcome = "deleted" if verify_password(password, row["delete_hash"]) else "wrong"
            if outcome == "deleted":
                db.execute(f"DELETE FROM {kind} WHERE id = ?", (item_id,))
        # 예외는 트랜잭션을 커밋한 뒤에 던진다. 안에서 던지면 틀린 시도의 횟수까지 되돌려져 대입 제한이 풀린다.
        if outcome == "missing":
            raise MissingPost() if kind == "posts" else MissingComment()
        if outcome == "disabled":
            raise AuthorDeleteDisabled()
        if outcome == "wrong":
            raise WrongPassword()

    @staticmethod
    def _now():
        return datetime.now(timezone.utc).isoformat()
