"""게시판에 예시 글을 넣거나 지운다.

    python -m scripts.seed_community            # 예시 글이 없으면 넣는다
    python -m scripts.seed_community --remove   # 예시 글·댓글만 지운다
    python -m scripts.seed_community --status   # 예시 글 수만 본다

backend 폴더에서 실행한다. 데이터 파일은 서버와 같은 COMMUNITY_DB_PATH(기본 data/community.sqlite3)를 쓴다.
"""
import argparse

from app.community.seed import count_examples, remove_examples, seed_examples
from app.community.store import CommunityStore
from app.config import load_settings


def main():
    parser = argparse.ArgumentParser(description="게시판 예시 글 넣기·지우기")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--remove", action="store_true", help="예시 글과 예시 댓글을 지운다")
    group.add_argument("--status", action="store_true", help="예시 글 수만 출력한다")
    args = parser.parse_args()
    store = CommunityStore(load_settings().community_db_path)
    if args.status:
        print(f"예시 글 {count_examples(store)}개")
    elif args.remove:
        print(f"예시 글 {remove_examples(store)}개를 지웠습니다.")
    else:
        added = seed_examples(store)
        print(f"예시 글 {added}개를 넣었습니다." if added else "예시 글이 이미 있어 넣지 않았습니다(--remove 뒤 다시 실행).")


if __name__ == "__main__":
    main()
