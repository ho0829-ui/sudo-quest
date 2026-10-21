import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request, Response

from app.config import Settings
from app.community.models import Category, CommentInput, DeleteInput, PostInput
from app.community.store import (AuthorDeleteDisabled, CommunityStore, MissingComment, MissingPost,
                                 TooManyWrites, WrongPassword)

PositiveId = Annotated[int, Path(ge=1, le=9223372036854775807)]
Page = Annotated[int, Query(ge=1, le=1000000)]
PageSize = Annotated[int, Query(ge=1, le=50)]


def community_router(settings: Settings):
    """
    삭제는 두 갈래다.
    - 작성자: 글·댓글을 쓸 때 정한 삭제 비밀번호로 POST .../delete. 비밀번호 없이 쓴 것은 지울 수 없다.
    - 관리자: 서버 .env의 COMMUNITY_ADMIN_KEY를 Bearer로 보내는 DELETE. 키는 프런트 코드에 없고,
      운영자가 화면에 직접 입력하면 그 탭의 메모리에만 머문다.
    """
    router = APIRouter(prefix="/api/community", tags=["community"])
    store = CommunityStore(settings.community_db_path)

    def write_origin(request: Request):
        origin = request.headers.get("origin")
        if origin and origin not in settings.cors_origins:
            raise HTTPException(403, "origin_not_allowed")

    def admin(authorization: Annotated[str | None, Header()] = None):
        key = settings.community_admin_key.get_secret_value()
        if not key:
            raise HTTPException(503, "moderation_disabled")
        expected = f"Bearer {key}".encode()
        if not secrets.compare_digest((authorization or "").encode(), expected):
            raise HTTPException(401, "unauthorized", headers={"WWW-Authenticate": "Bearer"})

    def run(operation):
        try:
            return operation()
        except MissingPost:
            raise HTTPException(404, "post_not_found") from None
        except MissingComment:
            raise HTTPException(404, "comment_not_found") from None
        except TooManyWrites:
            raise HTTPException(429, "write_rate_limited", headers={"Retry-After": "60"}) from None
        except WrongPassword:
            raise HTTPException(403, "wrong_password") from None
        except AuthorDeleteDisabled:
            raise HTTPException(403, "author_delete_disabled") from None

    def client(request: Request):
        return request.client.host if request.client else "unknown"

    @router.get("/posts")
    def posts(category: Category | None = None, q: str = Query(default="", max_length=100),
              page: Page = 1, page_size: PageSize = 20):
        return store.list_posts(category, q.strip(), page, page_size)

    @router.get("/posts/{post_id}")
    def post(post_id: PositiveId):
        return run(lambda: store.detail(post_id))

    @router.get("/posts/{post_id}/comments")
    def comments(post_id: PositiveId, page: Page = 1, page_size: PageSize = 20):
        return run(lambda: store.comments(post_id, page, page_size))

    @router.post("/posts", status_code=201, dependencies=[Depends(write_origin)])
    def create_post(payload: PostInput, request: Request):
        return run(lambda: store.create_post(payload.model_dump(), client(request)))

    @router.post("/posts/{post_id}/comments", status_code=201, dependencies=[Depends(write_origin)])
    def create_comment(post_id: PositiveId, payload: CommentInput, request: Request):
        return run(lambda: store.create_comment(post_id, payload.model_dump(), client(request)))

    @router.post("/posts/{post_id}/delete", status_code=204, dependencies=[Depends(write_origin)])
    def delete_own_post(post_id: PositiveId, payload: DeleteInput, request: Request):
        run(lambda: store.delete_by_author("posts", post_id, payload.password, client(request)))
        return Response(status_code=204)

    @router.post("/comments/{comment_id}/delete", status_code=204, dependencies=[Depends(write_origin)])
    def delete_own_comment(comment_id: PositiveId, payload: DeleteInput, request: Request):
        run(lambda: store.delete_by_author("comments", comment_id, payload.password, client(request)))
        return Response(status_code=204)

    @router.get("/admin", status_code=204, dependencies=[Depends(admin)])
    def admin_check():
        """화면의 운영자 모드가 입력한 키를 확인한다. 성공하면 내용 없이 204."""
        return Response(status_code=204)

    @router.delete("/posts/{post_id}", status_code=204, dependencies=[Depends(write_origin), Depends(admin)])
    def delete_post(post_id: PositiveId):
        if not store.delete("posts", post_id):
            raise HTTPException(404, "post_not_found")
        return Response(status_code=204)

    @router.delete("/comments/{comment_id}", status_code=204, dependencies=[Depends(write_origin), Depends(admin)])
    def delete_comment(comment_id: PositiveId):
        if not store.delete("comments", comment_id):
            raise HTTPException(404, "comment_not_found")
        return Response(status_code=204)

    return router
