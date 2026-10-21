# 제3자 자료 고지 (Third-Party Notices)

이 저장소의 `backend/catalog/`에는 아래 공식 문서에서 추출한 짧은 발췌(오류 정의 문장, 절 제목, 절 앞부분 요약)와 출처 정보가 들어 있다. 발췌는 원문을 그대로 옮겼고, 변경 사항은 다음이 전부다.

- HTML에서 해당 절만 추출했다.
- 공백·줄바꿈을 정리했다.
- 길이를 자른 경우가 있다(항목 `source_excerpt` 최대 600자, 절 카탈로그 `summary` 최대 240자).

한국어 제목·증상·요약(`annotations_ko.json`)은 원문을 바탕으로 작성한 별도 설명이다. 원문의 번역본이 아니다. 질문 시 수집하는 원문 전체와 캐시(`backend/data/`)는 저장소에 포함하지 않는다.

| 출처 | 저작자 | 원문 | 라이선스·이용 조건 |
|---|---|---|---|
| curl 매뉴얼(Exit codes, 옵션) | curl contributors (Daniel Stenberg 외) | https://curl.se/docs/manpage.html | curl license — https://curl.se/docs/copyright.html |
| libcurl 오류 코드 | curl contributors | https://curl.se/libcurl/c/libcurl-errors.html | curl license — 위와 같음 |
| Linux man-pages errno(3) | Linux man-pages project (Andries E. Brouwer 외) · HTML: man7.org | https://man7.org/linux/man-pages/man3/errno.3.html (man-pages 6.19) | GPL-2.0-or-later (소스 SPDX 표기) |
| Linux man-pages connect(2), open(2), write(2) | Linux man-pages project · HTML: man7.org | https://man7.org/linux/man-pages/man2/ | Linux-man-pages-copyleft (소스 SPDX 표기) |
| Elastic Load Balancing — Application Load Balancer 문제 해결, 타깃 그룹 헬스체크 | Amazon Web Services, Inc. | https://docs.aws.amazon.com/elasticloadbalancing/latest/application/ | CC BY-SA 4.0 (AWS Site Terms, https://aws.amazon.com/terms/) |

- 출처별 라이선스와 이용 조건 URL은 `backend/catalog/sources.json`, 문서별 정보는 `backend/catalog/documents.json`에 기계가 읽을 수 있는 형태로 남겼다. 서비스 화면의 근거 카드에도 출판자와 라이선스를 표시한다.
- Linux man-pages 라이선스는 man-pages 소스 파일의 SPDX 표기로 확인했다. 수집한 HTML(man-pages 6.19)과 같은 버전의 파일인지는 확인하지 못했다.
- AWS 문서 발췌(CC BY-SA 4.0)를 다시 배포할 때는 저작자·출처·라이선스를 표시하고 같은 조건을 유지해야 한다.
