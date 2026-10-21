from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

CommandName = Annotated[str, StringConstraints(min_length=1, max_length=30, pattern=r"^[a-z][a-z0-9_-]*$")]
Operation = Annotated[str, StringConstraints(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9 _-]*$")]


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


class Observation(StrictModel):
    """플레이어가 실제로 실행해 화면에 나온 결과 한 건. 숨겨진 상태는 담지 않는다."""
    command: str = Field(min_length=1, max_length=500)
    stdout: str = Field(default="", max_length=4000)
    stderr: str = Field(default="", max_length=2000)
    exit_code: int
    truncated: bool = False


class CoachRequest(StrictModel):
    """코치 요청. 허용 필드만 받는다(faults·answerId·solutionPath·state 등은 422)."""
    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9-]+$")
    question: str = Field(min_length=1, max_length=1000)
    ticket: str = Field(min_length=1, max_length=2000)
    revealed_hints: list[str] = Field(default_factory=list, max_length=3)
    observations: list[Observation] = Field(default_factory=list, max_length=30)
    omitted_observations: int = Field(default=0, ge=0)
    available_commands: list[str] = Field(default_factory=list, max_length=80)
    # 하위 명령이 있는 명령의 지원 목록(예: {"aws": ["elbv2 describe-target-groups"]}). 엔진 공통 정보다.
    command_operations: dict[CommandName, list[Operation]] = Field(default_factory=dict, max_length=10)
    item_id: str | None = Field(default=None, max_length=100)
    history: list[Message] = Field(default_factory=list, max_length=6)

    @field_validator("command_operations")
    @classmethod
    def limit_operations(cls, value):
        if any(len(ops) > 60 for ops in value.values()):
            raise ValueError("too_many_operations")
        return value


class CoachAnswer(StrictModel):
    answer: str = Field(min_length=1, max_length=12000)
    cited_evidence_ids: list[int] = Field(max_length=20)
    cited_observation_ids: list[int] = Field(default_factory=list, max_length=30)
    suggested_checks: list[str] = Field(default_factory=list, max_length=5)
