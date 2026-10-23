"""익명 글·댓글의 삭제 비밀번호. 표준 라이브러리 scrypt로 해시하고 평문은 어디에도 남기지 않는다.

로그인이 없는 게시판이라, 실수로 비밀 키·개인정보를 올린 사람이 관리자를 기다리지 않고
스스로 지울 수 있게 하는 장치다. 대입 공격은 라우터의 작성 속도 제한이 함께 막는다.
"""
import hashlib
import hmac
import os

# 해시 한 번에 메모리 16MB·수십 ms. 사람이 쓰기에는 충분히 빠르고 대량 대입은 느리게 만든다.
N, R, P, LENGTH = 2 ** 14, 8, 1, 32


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, dklen=LENGTH)
    return f"scrypt${N}${R}${P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        expected = bytes.fromhex(digest)
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt),
                                   n=int(n), r=int(r), p=int(p), dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, expected)
