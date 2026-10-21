import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.coach import numbered_observations, unsupported_commands, validate_coach_answer
from app.config import Settings
from app.contracts import CoachAnswer, CoachRequest
from app.main import create_app

BASE = {"session_id": "test-session-1", "question": "다음엔 뭘 볼까요?", "ticket": "사이트가 안 열려요",
        "observations": [{"command": "df -h", "stdout": "/dev/sda1 100%", "stderr": "", "exit_code": 0}]}


class CoachTests(unittest.TestCase):
    def test_private_fields_rejected_without_echo(self):
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(create_app(Settings(chroma_path=Path(folder)))) as client:
                for field in ("faults", "answerId", "solutionPath", "state", "postmortem", "scenario_id"):
                    r = client.post("/api/coach", json={**BASE, field: "secret-marker"})
                    self.assertEqual(r.status_code, 422, field)
                    self.assertNotIn("secret-marker", r.text)
                self.assertEqual(client.post("/api/coach", json={**BASE, "item_id": "nope"}).status_code, 404)

    def test_observation_numbers_continue_after_omitted(self):
        request = CoachRequest(**{**BASE, "omitted_observations": 4})
        self.assertEqual(numbered_observations(request)[0]["observation_id"], 5)

    def test_both_citation_kinds_must_exist(self):
        evidence = [{"evidence_id": 1}, {"evidence_id": 2}]
        observations = [{"observation_id": 1}]
        ok = CoachAnswer(answer="디스크가 100%다 [실습 기록 1]. 의미는 [근거 2]", cited_evidence_ids=[2],
                         cited_observation_ids=[1])
        self.assertEqual(validate_coach_answer(ok, evidence, observations), ([2], [1]))
        with self.assertRaisesRegex(ValueError, "invalid_observation_citations"):
            validate_coach_answer(CoachAnswer(answer="[실습 기록 7]", cited_evidence_ids=[],
                                              cited_observation_ids=[7]), evidence, observations)
        with self.assertRaisesRegex(ValueError, "uncited_answer"):
            validate_coach_answer(CoachAnswer(answer="원인은 디스크입니다", cited_evidence_ids=[]), evidence, observations)

    def test_unsupported_command_detected_unless_marked(self):
        answer = CoachAnswer(answer="x", cited_evidence_ids=[], suggested_checks=[
            "`du -sh /var/log` 로 확인", "`lsof +L1` 확인", "`strace -p 1` (실제 환경 참고)"])
        self.assertEqual(unsupported_commands(answer, ["du", "df"]), ["lsof"])

    def test_unsupported_subcommand_detected(self):
        operations = {"aws": ["elbv2 describe-target-health", "sts get-caller-identity"]}
        answer = CoachAnswer(answer="x", cited_evidence_ids=[], suggested_checks=[
            "`aws elbv2 describe-target-health --target-group-arn arn:x`로 상태 확인",
            "`sudo aws sts get-caller-identity` 확인, `/var/log` 경로는 명령이 아님",
            "`aws cloudwatch describe-alarms --alarm-name-prefix shop`로 알람 확인",
            "`aws --output json elbv2 describe-target-health`"])  # 옵션이 앞에 오면 보수적으로 경고
        self.assertEqual(unsupported_commands(answer, ["aws"], operations),
                         ["aws cloudwatch describe-alarms", "aws json elbv2"])

    def test_command_operations_contract(self):
        CoachRequest(**BASE, command_operations={"aws": ["elbv2 describe-target-groups"]})
        for bad in ({"AWS": ["x"]}, {"aws": ["<script>"]}, {"aws": ["x"] * 61}):
            with self.assertRaises(ValidationError):
                CoachRequest(**BASE, command_operations=bad)


class CoachPipelineTests(unittest.TestCase):
    def test_auto_items_from_observations_two_nodes_and_cache(self):
        from unittest.mock import patch
        from app.coach import coach
        from app.contracts import SearchTerms
        from app.corpus import prepare
        from app.indexing import open_store
        from tests.test_discovery import fake_vectors, fixture_document

        with tempfile.TemporaryDirectory() as folder, \
                patch("app.corpus.Collector.fetch", return_value={}), \
                patch("app.collectors.Collector.document", fixture_document):
            settings = Settings(chroma_path=Path(folder) / "chroma", llm_api_key="t", embedding_api_key="t",
                                embedding_base_url="https://example.com/v1/", embedding_model="t")
            prepare(settings, fake_vectors)
            store, collections = open_store(settings.chroma_path)
            payloads = []

            def model(settings, system, payload, schema):
                payloads.append(payload)
                if schema is SearchTerms:
                    return SearchTerms(queries=["No space left on device"])
                return CoachAnswer(answer="df 결과가 100%입니다 [실습 기록 1]. 공간 부족의 뜻은 [근거 1]",
                                   cited_evidence_ids=[1], cited_observation_ids=[1],
                                   suggested_checks=["`du -sh /var/log` 로 큰 디렉터리 확인"])
            try:
                with patch("app.coach.json_call", side_effect=model), patch("app.coach.embed", side_effect=fake_vectors):
                    request = CoachRequest(**BASE, available_commands=["df", "du"])
                    result = coach(settings, collections, request)
                    self.assertEqual(len(result["trace"]["item_ids"]), 3)
                    self.assertEqual(result["trace"]["graph_nodes"], ["retrieve", "generate"])
                    self.assertEqual([o["observation_id"] for o in result["observations"]], [1])
                    self.assertEqual(result["warnings"], [])
                    # 모델 입력에는 공개 정보만 있다.
                    self.assertNotIn("faults", str(payloads))
                    calls = len(payloads)
                    self.assertTrue(coach(settings, collections, request)["cache_hit"])
                    self.assertEqual(len(payloads), calls)
            finally:
                store.close()
