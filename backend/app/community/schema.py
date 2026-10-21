"""게시판 SQLite 스키마와 버전 올리기.

PRAGMA user_version으로 스키마 버전을 기록한다. 이미 만들어진 데이터 파일도 열 때 한 번
빠진 열을 더해 최신 버전으로 맞추므로, 사용자가 데이터 파일을 지우지 않아도 된다.
"""
import sqlite3

SCHEMA_VERSION = 2

# 버전 1: 처음 배포한 표. 새 열은 아래 MIGRATIONS로만 더한다(이 문장을 고치지 않는다).
BASE = """
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL,
 category TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 body TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id, id);
CREATE INDEX IF NOT EXISTS posts_category ON posts(category, id);
CREATE TABLE IF NOT EXISTS write_limits (
 client TEXT PRIMARY KEY, started REAL NOT NULL, count INTEGER NOT NULL
);
"""

# 버전 2: 풀이가 담긴 글 표시(spoiler)와 작성자 삭제 비밀번호의 해시(평문은 저장하지 않는다).
MIGRATIONS = {
    2: [("posts", "spoiler", "INTEGER NOT NULL DEFAULT 0"),
        ("posts", "delete_hash", "TEXT"),
        ("comments", "delete_hash", "TEXT")],
}

# 응답에 내보내는 열. delete_hash는 절대 내보내지 않고, 비밀번호가 있는지만 알린다.
POST_COLUMNS = "id, title, body, author, category, spoiler, created_at, delete_hash IS NOT NULL AS deletable"
COMMENT_COLUMNS = "id, post_id, body, author, created_at, delete_hash IS NOT NULL AS deletable"


def _add_column(db: sqlite3.Connection, table: str, column: str, definition: str):
    names = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    if column in names:
        return
    try:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    except sqlite3.OperationalError as error:
        # 다른 연결이 같은 순간에 먼저 더했으면 그대로 둔다.
        if "duplicate column" not in str(error):
            raise


def prepare(db: sqlite3.Connection):
    """표를 만들고 user_version이 낮으면 빠진 열을 더한다. 여러 번 불러도 결과가 같다."""
    db.executescript(BASE)
    version = db.execute("PRAGMA user_version").fetchone()[0]
    for target in sorted(MIGRATIONS):
        if version < target:
            for table, column, definition in MIGRATIONS[target]:
                _add_column(db, table, column, definition)
            db.execute(f"PRAGMA user_version = {int(target)}")
            version = target
    db.commit()
