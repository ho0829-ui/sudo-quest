"""예시 글 넣기·지우기. 화면 요청이 아니라 관리 스크립트(scripts.seed_community)에서만 부른다.

작성 속도 제한·Origin 검사는 사람이 쓰는 API에만 있으므로 여기서는 저장소에 직접 쓴다.
예시 글은 삭제 비밀번호가 없어(작성자 삭제 불가) 화면에서는 운영자만 지울 수 있고, 이 모듈로 한꺼번에 지운다.
"""
from datetime import datetime, timedelta, timezone

from app.community.examples import EXAMPLE_POSTS
from app.community.store import CommunityStore


def _at(now: datetime, days: int, hour: int, minutes: int = 0) -> str:
    day = (now - timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)
    # 0일 전 글의 시각이 지금보다 뒤면 미래 글이 되므로 지금 직전으로 당긴다.
    if day > now:
        day = now - timedelta(hours=1)
    return (day + timedelta(minutes=minutes)).isoformat()


def count_examples(store: CommunityStore) -> int:
    with store.connection() as db:
        return db.execute("SELECT count(*) FROM posts WHERE example = 1").fetchone()[0]


def seed_examples(store: CommunityStore, now: datetime | None = None) -> int:
    """예시 글이 하나도 없을 때만 넣는다(여러 번 실행해도 두 벌이 되지 않음). 넣은 글 수를 돌려준다."""
    now = now or datetime.now(timezone.utc)
    if count_examples(store):
        return 0
    # 목록은 번호 역순이라, 오래된 글부터 넣어야 날짜와 순서가 맞는다.
    ordered = sorted(EXAMPLE_POSTS, key=lambda p: (-p["days"], p["hour"]))
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        for post in ordered:
            created = _at(now, post["days"], post["hour"])
            cursor = db.execute("""INSERT INTO posts(title, body, author, category, spoiler, example, created_at)
                                   VALUES (?, ?, ?, ?, ?, 1, ?)""",
                                (post["title"], post["body"], post["author"], post["category"], int(post.get("spoiler", False)), created))
            for author, body, minutes in post["comments"]:
                db.execute("INSERT INTO comments(post_id, body, author, example, created_at) VALUES (?, ?, ?, 1, ?)",
                           (cursor.lastrowid, body, author, _at(now, post["days"], post["hour"], minutes)))
    return len(ordered)


def remove_examples(store: CommunityStore) -> int:
    """예시 글과 예시 댓글만 지운다. 사람이 쓴 글·댓글은 그대로 둔다(예시 글에 단 사람 댓글은 글과 함께 지워진다)."""
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM comments WHERE example = 1")
        return db.execute("DELETE FROM posts WHERE example = 1").rowcount
