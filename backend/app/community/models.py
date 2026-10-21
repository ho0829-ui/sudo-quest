from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["question", "tip", "review", "free"]


class CommentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    author: str = Field(min_length=1, max_length=24)
    body: str = Field(min_length=1, max_length=2000)
    # 선택. 있으면 작성자가 이 비밀번호로 직접 지울 수 있다. 저장은 해시로만 한다.
    password: str | None = Field(default=None, min_length=4, max_length=64)


class PostInput(CommentInput):
    title: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=10000)
    category: Category
    # 실습 풀이(원인·조치)가 담긴 글. 목록 미리보기를 숨기고 상세에서 펼쳐 보게 한다.
    spoiler: bool = False


class DeleteInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    password: str = Field(min_length=1, max_length=64)
