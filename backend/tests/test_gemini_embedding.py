"""Gemini 임베딩(batchEmbedContents) 요청 모양·응답 검사·오류 처리. 실제 API는 부르지 않는다."""
import unittest
from unittest.mock import MagicMock, patch

import requests
from pydantic import SecretStr

from app.config import Settings
from app.providers import ProviderError, embed

BASE = "https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com/v1beta/"
KEY = "test-key-never-real"


def settings():
    return Settings(embedding_api="gemini", embedding_base_url=BASE, embedding_model="gemini-embedding-2",
                    embedding_api_key=SecretStr(KEY))


def reply(status=200, body=None):
    response = MagicMock(status_code=status)
    response.json.return_value = body
    return response


class GeminiEmbeddingTests(unittest.TestCase):
    def test_request_shape_and_order(self):
        body = {"embeddings": [{"values": [0.1, 0.2]}, {"values": [0.3, 0.4]}]}
        with patch("app.providers.requests.post", return_value=reply(body=body)) as post:
            vectors = embed(settings(), ["가", "나"])
        self.assertEqual(vectors, [[0.1, 0.2], [0.3, 0.4]])
        url = post.call_args.args[0]
        self.assertEqual(url, BASE + "models/gemini-embedding-2:batchEmbedContents")
        sent = post.call_args.kwargs
        self.assertEqual(sent["headers"]["x-goog-api-key"], KEY)
        self.assertNotIn(KEY, url)  # 키는 주소(쿼리)가 아니라 헤더로만 보낸다.
        self.assertEqual([r["content"]["parts"][0]["text"] for r in sent["json"]["requests"]], ["가", "나"])
        self.assertEqual({r["model"] for r in sent["json"]["requests"]}, {"models/gemini-embedding-2"})

    def test_rejects_wrong_count_dimension_or_values(self):
        for body in ({"embeddings": [{"values": [0.1]}]}, {"embeddings": [{"values": [0.1]}, {"values": [0.1, 0.2]}]},
                     {"embeddings": [{"values": [float("nan")]}, {"values": [0.1]}]}, {"unexpected": True},
                     {"embeddings": [{"values": ["x"]}, {"values": ["y"]}]}):
            with patch("app.providers.requests.post", return_value=reply(body=body)):
                with self.assertRaises(ProviderError) as caught:
                    embed(settings(), ["가", "나"])
            self.assertEqual(str(caught.exception), "invalid_embedding_response")

    def test_http_and_network_errors_hide_details(self):
        with patch("app.providers.requests.post", return_value=reply(status=401, body={"error": KEY})):
            with self.assertLogs("infracoach.providers", "WARNING") as logs, self.assertRaises(ProviderError) as caught:
                embed(settings(), ["가"])
        self.assertEqual(str(caught.exception), "embedding_request_failed")
        self.assertNotIn(KEY, "".join(logs.output))
        with patch("app.providers.requests.post", side_effect=requests.ConnectionError(KEY)):
            with self.assertLogs("infracoach.providers", "WARNING") as logs, self.assertRaises(ProviderError):
                embed(settings(), ["가"])
        self.assertNotIn(KEY, "".join(logs.output))

    def test_missing_key_never_calls_network(self):
        missing = Settings(embedding_api="gemini", embedding_base_url=BASE, embedding_model="gemini-embedding-2")
        with patch("app.providers.requests.post") as post, self.assertRaises(ProviderError):
            embed(missing, ["가"])
        post.assert_not_called()
