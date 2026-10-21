from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Message(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(StrictModel):
    item_id: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=2000)
    history: list[Message] = Field(default_factory=list, max_length=10)


class SearchTerms(StrictModel):
    queries: list[str] = Field(min_length=1, max_length=3)


class Selection(StrictModel):
    selected_ids: list[str] = Field(max_length=20)
    reasons: dict[str, str]


class Answer(StrictModel):
    answer: str = Field(min_length=1, max_length=12000)
    cited_evidence_ids: list[int] = Field(max_length=20)
    suggested_checks: list[str] = Field(default_factory=list, max_length=5)
    warnings: list[str] = Field(default_factory=list, max_length=5)


class ExploreRequest(StrictModel):
    query: str = Field(min_length=1, max_length=500)


class ExploreMatch(StrictModel):
    item_id: str
    reason: str = Field(min_length=1, max_length=500)


class ExploreJudgement(StrictModel):
    matches: list[ExploreMatch] = Field(max_length=30)
    unverifiable_conditions: list[str] = Field(default_factory=list, max_length=5)
