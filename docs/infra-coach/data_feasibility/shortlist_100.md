# 우선 검토할 장애 지식 항목 100건

curl 40건 + Linux errno 40건 + AWS ALB 20건. 선택·수집 가능성 확인용 목록이며 최종 과제 데이터셋이 아니다. 오류 코드별 의미, 문서 적용 조건, 한국어 메타데이터, 라이선스 기록을 추가 검수해야 한다.

| 번호 | ID | 원문 항목 | 상세 문서 보강 | 출처 |
|---|---|---|---|---|
| 1 | curl-1 | curl exit 1: Unsupported protocol | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#1) |
| 2 | curl-3 | curl exit 3: URL malformed | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#3) |
| 3 | curl-4 | curl exit 4: A feature or option that was needed to perform the desired request was not enabled or was explicitly disabled at build-time | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#4) |
| 4 | curl-5 | curl exit 5: Could not resolve proxy | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#5) |
| 5 | curl-6 | curl exit 6: Could not resolve host | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#6) |
| 6 | curl-7 | curl exit 7: Failed to connect to host | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#7) |
| 7 | curl-8 | curl exit 8: Weird server reply | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#8) |
| 8 | curl-16 | curl exit 16: HTTP/2 error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#16) |
| 9 | curl-18 | curl exit 18: Partial file | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#18) |
| 10 | curl-22 | curl exit 22: HTTP page not retrieved | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#22) |
| 11 | curl-23 | curl exit 23: Write error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#23) |
| 12 | curl-26 | curl exit 26: Read error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#26) |
| 13 | curl-27 | curl exit 27: Out of memory | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#27) |
| 14 | curl-28 | curl exit 28: Operation timeout | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#28) |
| 15 | curl-33 | curl exit 33: HTTP range error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#33) |
| 16 | curl-34 | curl exit 34: HTTP post error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#34) |
| 17 | curl-35 | curl exit 35: SSL connect error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#35) |
| 18 | curl-36 | curl exit 36: Bad download resume | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#36) |
| 19 | curl-37 | curl exit 37: FILE could not read file | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#37) |
| 20 | curl-45 | curl exit 45: Interface error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#45) |
| 21 | curl-47 | curl exit 47: Too many redirects | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#47) |
| 22 | curl-52 | curl exit 52: The server did not reply anything, which here is considered an error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#52) |
| 23 | curl-55 | curl exit 55: Failed sending network data | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#55) |
| 24 | curl-56 | curl exit 56: Failure in receiving network data | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#56) |
| 25 | curl-58 | curl exit 58: Problem with the local certificate | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#58) |
| 26 | curl-59 | curl exit 59: Could not use specified SSL cipher | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#59) |
| 27 | curl-60 | curl exit 60: Peer certificate cannot be authenticated with known CA certificates | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#60) |
| 28 | curl-61 | curl exit 61: Unrecognized transfer encoding | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#61) |
| 29 | curl-63 | curl exit 63: Maximum file size exceeded | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#63) |
| 30 | curl-67 | curl exit 67: The username, password, or similar was not accepted and curl failed to log in | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#67) |
| 31 | curl-77 | curl exit 77: Problem reading the SSL CA cert (path? access rights?) | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#77) |
| 32 | curl-78 | curl exit 78: The resource referenced in the URL does not exist | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#78) |
| 33 | curl-82 | curl exit 82: Could not load CRL file, missing or wrong format | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#82) |
| 34 | curl-90 | curl exit 90: SSL public key does not match pinned public key | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#90) |
| 35 | curl-91 | curl exit 91: Invalid SSL certificate status | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#91) |
| 36 | curl-92 | curl exit 92: Stream error in HTTP/2 framing layer | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#92) |
| 37 | curl-95 | curl exit 95: A problem was detected in the HTTP/3 layer | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#95) |
| 38 | curl-96 | curl exit 96: QUIC connection error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#96) |
| 39 | curl-97 | curl exit 97: Proxy handshake error | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#97) |
| 40 | curl-98 | curl exit 98: A client-side certificate is required to complete the TLS handshake | 추가 선별 필요 | [원문](https://curl.se/docs/manpage.html#98) |
| 41 | linux-errno-EACCES | EACCES: Permission denied (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html), [문서 2](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 42 | linux-errno-EADDRINUSE | EADDRINUSE: Address already in use (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 43 | linux-errno-EADDRNOTAVAIL | EADDRNOTAVAIL: Address not available (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 44 | linux-errno-EAGAIN | EAGAIN: Resource temporarily unavailable (may be the same value as EWOULDBLOCK ) (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html), [문서 2](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 45 | linux-errno-EALREADY | EALREADY: Connection already in progress (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 46 | linux-errno-EBADF | EBADF: Bad file descriptor (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html), [문서 2](https://man7.org/linux/man-pages/man2/open.2.html), [문서 3](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 47 | linux-errno-EBUSY | EBUSY: Device or resource busy (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 48 | linux-errno-ECONNABORTED | ECONNABORTED: Connection aborted (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 49 | linux-errno-ECONNREFUSED | ECONNREFUSED: Connection refused (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 50 | linux-errno-ECONNRESET | ECONNRESET: Connection reset (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 51 | linux-errno-EDQUOT | EDQUOT: Disk quota exceeded (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html), [문서 2](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 52 | linux-errno-EEXIST | EEXIST: File exists (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 53 | linux-errno-EFBIG | EFBIG: File too large (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html), [문서 2](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 54 | linux-errno-EHOSTUNREACH | EHOSTUNREACH: Host is unreachable (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 55 | linux-errno-EINPROGRESS | EINPROGRESS: Operation in progress (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 56 | linux-errno-EINTR | EINTR: Interrupted function call (POSIX.1-2001); see signal(7)  | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html), [문서 2](https://man7.org/linux/man-pages/man2/open.2.html), [문서 3](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 57 | linux-errno-EINVAL | EINVAL: Invalid argument (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html), [문서 2](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 58 | linux-errno-EIO | EIO: Input/output error (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 59 | linux-errno-EISDIR | EISDIR: Is a directory (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 60 | linux-errno-ELOOP | ELOOP: Too many levels of symbolic links (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 61 | linux-errno-EMFILE | EMFILE: Too many open files (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 62 | linux-errno-ENAMETOOLONG | ENAMETOOLONG: Filename too long (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 63 | linux-errno-ENETDOWN | ENETDOWN: Network is down (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 64 | linux-errno-ENETUNREACH | ENETUNREACH: Network unreachable (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 65 | linux-errno-ENFILE | ENFILE: Too many open files in system (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 66 | linux-errno-ENOBUFS | ENOBUFS: No buffer space available (POSIX.1 (XSI STREAMS option)) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 67 | linux-errno-ENODEV | ENODEV: No such device (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 68 | linux-errno-ENOENT | ENOENT: No such file or directory (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 69 | linux-errno-ENOEXEC | ENOEXEC: Exec format error (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 70 | linux-errno-ENOMEM | ENOMEM: Not enough space/cannot allocate memory (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 71 | linux-errno-ENOSPC | ENOSPC: No space left on device (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html), [문서 2](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 72 | linux-errno-ENOTCONN | ENOTCONN: The socket is not connected (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 73 | linux-errno-ENOTDIR | ENOTDIR: Not a directory (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 74 | linux-errno-ENOTEMPTY | ENOTEMPTY: Directory not empty (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 75 | linux-errno-ENOTSOCK | ENOTSOCK: Not a socket (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 76 | linux-errno-EPERM | EPERM: Operation not permitted (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html), [문서 2](https://man7.org/linux/man-pages/man2/open.2.html), [문서 3](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 77 | linux-errno-EPIPE | EPIPE: Broken pipe (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/write.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 78 | linux-errno-EROFS | EROFS: Read-only filesystem (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/open.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 79 | linux-errno-ESRCH | ESRCH: No such process (POSIX.1-2001) | 추가 선별 필요 | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 80 | linux-errno-ETIMEDOUT | ETIMEDOUT: Connection timed out (POSIX.1-2001) | [문서 1](https://man7.org/linux/man-pages/man2/connect.2.html) | [원문](https://man7.org/linux/man-pages/man3/errno.3.html) |
| 81 | aws-alb-target-not-inservice | A registered target is not in service | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#target-not-inservice) |
| 82 | aws-alb-client-cannot-connect | Clients cannot connect to an internet-facing load balancer | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#client-cannot-connect) |
| 83 | aws-alb-custom-domain-request | Requests sent to a custom domain aren't received by the load balancer | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#custom-domain-request) |
| 84 | aws-alb-https-cert-invalid | HTTPS requests sent to the load balancer return "NET::ERR_CERT_COMMON_NAME_INVALID" | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#https-cert-invalid) |
| 85 | aws-alb-elevated-processing-time | Load balancer shows elevated processing times | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#elevated-processing-time) |
| 86 | aws-alb-http-400-issues | HTTP 400: Bad request | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-400-issues) |
| 87 | aws-alb-http-401-issues | HTTP 401: Unauthorized | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-401-issues) |
| 88 | aws-alb-http-403-issues | HTTP 403: Forbidden | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-403-issues) |
| 89 | aws-alb-http-405-issues | HTTP 405: Method not allowed | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-405-issues) |
| 90 | aws-alb-http-408-issues | HTTP 408: Request timeout | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-408-issues) |
| 91 | aws-alb-http-413-issues | HTTP 413: Payload too large | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-413-issues) |
| 92 | aws-alb-http-414-issues | HTTP 414: URI too long | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-414-issues) |
| 93 | aws-alb-http-460-issues | HTTP 460 | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-460-issues) |
| 94 | aws-alb-http-464-issues | HTTP 464 | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-464-issues) |
| 95 | aws-alb-http-500-issues | HTTP 500: Internal server error | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-500-issues) |
| 96 | aws-alb-http-502-issues | HTTP 502: Bad gateway | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-502-issues) |
| 97 | aws-alb-http-503-issues | HTTP 503: Service unavailable | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-503-issues) |
| 98 | aws-alb-http-504-issues | HTTP 504: Gateway timeout | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#http-504-issues) |
| 99 | aws-alb-target-http-errors | A target generates an HTTP error | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#target-http-errors) |
| 100 | aws-alb-acm-cert-unavailable | An AWS Certificate Manager certificate is not available for use | 추가 선별 필요 | [원문](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html#acm-cert-unavailable) |
