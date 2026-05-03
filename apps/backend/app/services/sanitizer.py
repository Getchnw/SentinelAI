import os
import hashlib
import logging
import tempfile
from dataclasses import dataclass, field

from detect_secrets import SecretsCollection
from detect_secrets.settings import default_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ชื่อไฟล์จำลองที่ใช้กับ detect-secrets
# detect-secrets ออกแบบมาสำหรับสแกนไฟล์จริง
# แต่เราสแกน string ตรงๆ ได้โดยให้ชื่อไฟล์จำลองไป
# ---------------------------------------------------------------------------
# _FAKE_FILENAME = "temp.py"

# ---------------------------------------------------------------------------
# รูปแบบของ token ที่เราจะใช้แทนค่าลับในโค้ด
# ---------------------------------------------------------------------------
_TOKEN_PREFIX = "__SECRET_"
_TOKEN_SUFFIX = "__"

@dataclass(frozen=True)
class SanitizationResult:
    sanitized_code: str
    token_map: dict[str, str] = field(default_factory=dict)


def _make_token(secret_value: str) -> str:
    """
    สร้าง token ที่ unique และ deterministic จากค่าความลับ
    ใช้ hash เพื่อให้ token มีความยาวคงที่และไม่เปิดเผยข้อมูลจริง
    ตัวอย่าง: "abc123secret" → "__SECRET_3d7a1f2b__"
    """
    short_hash = hashlib.sha256(secret_value.encode()).hexdigest()[:8]
    return f"{_TOKEN_PREFIX}{short_hash}{_TOKEN_SUFFIX}"


def sanitize_code(code: str) -> SanitizationResult:
    """
    สแกนโค้ดหาข้อมูลลับด้วย detect-secrets แล้วแทนที่ด้วย token
    Returns:
        SanitizationResult ที่มี:
          - sanitized_code: โค้ดที่ค่าลับถูกแทนที่ด้วย token แล้ว
          - token_map: mapping จาก token → ค่าลับจริง (สำหรับ desanitize ทีหลัง)
    """
    # ถ้า code ว่างเปล่า ไม่ต้องทำอะไรเลย
    if not code.strip():
        return SanitizationResult(sanitized_code=code)

    token_map: dict[str, str] = {}
    secrets = SecretsCollection()

# 1. สร้างไฟล์ชั่วคราว (Temporary File) ขึ้นมาจริงๆ เพื่อให้ detect-secrets อ่าน
    # delete=False เพราะเราจะให้มันเขียนเสร็จก่อน แล้วค่อยให้เราลบเองทีหลัง
    with tempfile.NamedTemporaryFile(mode="w+", delete=False, suffix=".py", encoding="utf-8") as tmp_file:
        tmp_file.write(code)
        tmp_file_path = tmp_file.name

    try:
        # 2. ใช้ scan_file และชี้ไปที่ไฟล์ชั่วคราวที่เราเพิ่งสร้าง
        with default_settings():
            secrets.scan_file(tmp_file_path)

        lines = code.split("\n")

        if tmp_file_path not in secrets:
            logger.debug("No secrets found in scanned code.")
            return SanitizationResult(sanitized_code=code)

        for secret in secrets[tmp_file_path]:
            line_idx = secret.line_number - 1
            secret_value = secret.secret_value

            if not (0 <= line_idx < len(lines) and secret_value):
                continue

            token = _make_token(secret_value)
            if token not in token_map:
                token_map[token] = secret_value

            lines[line_idx] = lines[line_idx].replace(secret_value, token)

        sanitized_code = "\n".join(lines)
        return SanitizationResult(sanitized_code=sanitized_code, token_map=token_map)

    finally:
        # 3. Clean up: ไม่ว่าจะเกิด Error กลางทางหรือไม่ ต้องลบไฟล์ชั่วคราวทิ้งเสมอ!
        if os.path.exists(tmp_file_path):
            os.remove(tmp_file_path)


def desanitize_code(code: str, token_map: dict[str, str]) -> str:
    """
    นำค่าลับจริงกลับมาแทนที่ token ทั้งหมดในโค้ด
    Returns:
        โค้ดที่คืนค่าลับกลับครบแล้ว
    """
    # Early return: ถ้าไม่มี token ให้ restore ก็ไม่ต้องวน loop
    if not token_map:
        return code

    restored = code
    for token, secret_value in token_map.items():
        restored = restored.replace(token, secret_value)

    return restored