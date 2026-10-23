import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from openai import APIConnectionError
import httpx
from pydantic import SecretStr, ValidationError

from app.config import Settings, load_settings
from app.graphs import build_graph
from app.main import create_app
from app.providers import ProviderError, embed, generate


class FoundationTests(unittest.TestCase):
    def test_health_without_keys_and_persistent_collections(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder))
            app = create_app(settings)
            with TestClient(app) as client:
                result = client.get("/api/health")
                self.assertEqual(result.status_code, 200)
                body = result.json()
                self.assertFalse(body["providers"]["generation"]["configured"])
                self.assertEqual(body["index"]["counts"], {"knowledge_items": 0, "reference_chunks": 0})
                collection = app.state.collections["knowledge_items"]
                for _ in range(2):
                    collection.upsert(ids=["fixture"], documents=["test only"], embeddings=[[1., 0., 0.]])
                self.assertEqual(collection.count(), 1)
                self.assertEqual(app.state.collections["reference_chunks"].count(), 0)
                self.assertEqual(client.get("/api/health").json()["index"]["status"], "present")
                self.assertNotIn("test-secret", result.text)
            with TestClient(create_app(settings)) as client:
                self.assertEqual(client.get("/api/health").json()["index"]["counts"]["knowledge_items"], 1)

    def test_graph_order(self):
        visited = []
        def retrieve(state):
            visited.append("retrieve")
            return {"evidence": []}
        def generate_node(state):
            visited.append("generate")
            return {"answer": "문서에서 확인되지 않습니다."}
        graph = build_graph(retrieve, generate_node)
        result = graph.invoke({"question": "test"})
        self.assertEqual(visited, ["retrieve", "generate"])
        self.assertIn("확인되지", result["answer"])

    def test_invalid_chunk_settings(self):
        with self.assertRaises(ValidationError):
            Settings(chunk_size=200, chunk_overlap=200)

    def test_gms_key_not_sent_to_personal_provider(self):
        with patch("app.config.load_dotenv"), patch.dict("os.environ", {
            "GMS_KEY": "test-secret", "LLM_BASE_URL": "https://api.example.com/v1/",
        }, clear=True):
            self.assertIn("LLM_API_KEY", load_settings().missing("generation"))

    def test_generation_responses_contract(self):
        settings = Settings(llm_api_key=SecretStr("test-secret"))
        with patch("app.providers.OpenAI") as constructor:
            mock = constructor.return_value.__enter__.return_value
            mock.responses.create.return_value = SimpleNamespace(status="completed", output_text="OK")
            self.assertEqual(generate(settings, "test"), "OK")
            args = mock.responses.create.call_args.kwargs
            self.assertEqual(args["model"], "gpt-6.1-sol")
            self.assertFalse(args["store"])
            self.assertEqual(constructor.call_args.kwargs["max_retries"], 0)

    def test_embedding_order_and_dimension_validation(self):
        settings = Settings(embedding_base_url="https://example.com/v1/",
                            embedding_model="fixture", embedding_api_key=SecretStr("test-secret"))
        with patch("app.providers.OpenAI") as constructor:
            mock = constructor.return_value.__enter__.return_value
            mock.embeddings.create.return_value = SimpleNamespace(data=[
                SimpleNamespace(index=1, embedding=[0., 1.]), SimpleNamespace(index=0, embedding=[1., 0.])])
            self.assertEqual(embed(settings, ["a", "b"]), [[1., 0.], [0., 1.]])
            mock.embeddings.create.return_value.data[0].embedding = [1.]
            with self.assertRaisesRegex(ProviderError, "invalid_embedding_response"):
                embed(settings, ["a", "b"])

    def test_provider_error_is_redacted(self):
        with patch("app.providers.OpenAI") as constructor:
            mock = constructor.return_value.__enter__.return_value
            mock.responses.create.side_effect = APIConnectionError(
                message="test-secret", request=httpx.Request("POST", "https://example.com"))
            with self.assertLogs("infracoach.providers", level="WARNING") as logs:
                with self.assertRaisesRegex(ProviderError, "^generation_request_failed$"):
                    generate(Settings(llm_api_key=SecretStr("test-secret")), "test")
            # 서버 로그에는 예외 종류만 남고 키·메시지는 남지 않는다.
            self.assertIn("APIConnectionError", logs.output[0])
            self.assertNotIn("test-secret", "".join(logs.output))

    def test_private_network_preflight_only_when_enabled_and_origin_allowed(self):
        pages = "https://ho0829-ui.github.io"
        headers = {"Origin": pages, "Access-Control-Request-Method": "GET", "Access-Control-Request-Private-Network": "true"}
        with tempfile.TemporaryDirectory() as folder:
            off = Settings(chroma_path=Path(folder), cors_origins=[pages])
            with TestClient(create_app(off)) as client:
                self.assertEqual(client.options("/api/health", headers=headers).status_code, 400)
            on = off.model_copy(update={"cors_allow_private_network": True})
            with TestClient(create_app(on)) as client:
                reply = client.options("/api/health", headers=headers)
                self.assertEqual(reply.status_code, 200)
                self.assertEqual(reply.headers.get("access-control-allow-private-network"), "true")
                other = client.options("/api/health", headers={**headers, "Origin": "https://evil.example"})
                self.assertNotEqual(other.headers.get("access-control-allow-origin"), "https://evil.example")

    def test_missing_configuration_never_calls_provider(self):
        with patch("app.providers.OpenAI") as constructor:
            with self.assertRaisesRegex(ProviderError, "missing_configuration"):
                generate(Settings(), "test")
            constructor.assert_not_called()


if __name__ == "__main__":
    unittest.main()
