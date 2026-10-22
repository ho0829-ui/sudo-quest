"""단계별 소요 시간(D2). 진행 단계 콜백(progress)을 감싸서, 단계가 바뀔 때마다 앞 단계의 시간을 잰다.

trace에는 숫자(초)만 남긴다. 질문·키·본문은 넣지 않는다.
"""
import time


class StageClock:
    def __init__(self, progress=lambda stage: None, clock=time.monotonic):
        self._progress = progress
        self._clock = clock
        self._started = clock()
        self._stage = "prepare"  # 매니페스트 확인·캐시 조회
        self._mark = self._started
        self.stages: dict[str, float] = {}

    def __call__(self, stage: str) -> None:
        self._close()
        self._stage = stage
        self._progress(stage)

    def _close(self) -> None:
        now = self._clock()
        self.stages[self._stage] = round(self.stages.get(self._stage, 0.0) + now - self._mark, 3)
        self._mark = now

    def finish(self) -> dict:
        self._close()
        return {"stages": dict(self.stages), "total": round(self._clock() - self._started, 3)}
