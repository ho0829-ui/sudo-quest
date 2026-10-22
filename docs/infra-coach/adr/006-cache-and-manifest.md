# 006. 답변 캐시 키와 색인 manifest

- **상황:** 같은 질문을 다시 하면 또 20초·유료 호출이 든다. 반대로 모델·문서·프롬프트가 바뀌었는데 옛 답을 주면 틀린 답이 된다. 임베딩 모델·청킹을 바꿨는데 옛 색인을 그대로 쓰면 벡터 차원·의미가 어긋난다.
- **결정:**
  - 답변 캐시 키 = 질문·대화 이력·항목 + 코퍼스 해시 + 생성 모델·주소 + top_k + 프롬프트 버전의 해시. 하나라도 바뀌면 새로 만든다. 코치는 공개 입력 전체를 키에 넣는다.
  - 검색어가 같으면 후보·선별 결과도 캐시한다(질문 캐시가 빗나가도 선별 호출을 아낌).
  - 색인 `manifest.json`에 임베딩 공급자·모델·정규화·청크 크기·겹침(identity)과 코퍼스 해시를 적고, 설정이 다르면 `index_configuration_changed`로 막는다. 같은 본문의 벡터는 공급자·모델 기준으로 캐시해 청크 설정만 바꿔도 다시 임베딩하지 않는다.
- **버린 대안:** 시간 기반 만료(TTL) — 무엇이 바뀌었는지와 무관하게 버리거나 남긴다.
- **결과:** 캐시 적중 응답은 1초 미만(22번 문서 지연 표), 재색인은 바뀐 것만. 대가: 캐시 파일이 계속 쌓인다(정리 정책 없음), 같은 의미의 다른 문장은 적중하지 않는다.
- **근거:** `backend/app/rag.py`(cache_key), `backend/app/coach.py`, `backend/app/corpus.py`(`check_manifest`, `cached_vectors`), `test_rag.test_rag_metadata_required_primary_forced_cache_and_item_scope`, `test_rag.VectorCacheTests`.
