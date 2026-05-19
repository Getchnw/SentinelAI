import os
import hashlib
import logging
import tempfile
from dataclasses import dataclass, field

import re
from detect_secrets import SecretsCollection
from detect_secrets.settings import default_settings
# from detect_secrets.settings import transient_settings

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
    สแกนโค้ดหาข้อมูลลับด้วย Regex ยอดนิยม และ detect-secrets 
    แล้วแทนที่ด้วย token อย่างถูกต้อง ปลอดภัยจาก AttributeError
    """
    if not code.strip():
        return SanitizationResult(sanitized_code=code)

    token_map: dict[str, str] = {}
    
    # =========================================================================
    # ขั้นตอนที่ 1: ตรวจจับด้วย Regex (Pattern Matching) - ป้องกันพิกัดไฟล์พังบน Windows
    # =========================================================================
    regex_patterns = {
        "AWS Access Key": r"AKIA[A-Z0-9]{16}",
        "AWS Secret Key": r"[a-zA-Z0-9/+=]{36,40}",
        "Slack Token": r"xox[bpa]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}",
        "GitHub Token": r"ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{82}",
        "OpenAI Token": r"sk-proj-[a-zA-Z0-9]{40,50}",
        "Stripe Token": r"sk_live_[a-zA-Z0-9]{24,50}"
    }

    current_sanitized_code = code

    for name, pattern in regex_patterns.items():
        matches = re.findall(pattern, current_sanitized_code)
        for secret_value in matches:
            if secret_value and secret_value not in token_map.values():
                if not secret_value.startswith(_TOKEN_PREFIX):
                    token = _make_token(secret_value)
                    token_map[token] = secret_value
                    current_sanitized_code = current_sanitized_code.replace(secret_value, token)

    # =========================================================================
    # ขั้นตอนที่ 2: ใช้ detect-secrets สแกนซ้ำ (Fallback เผื่อเจอ High Entropy ตัวอื่น)
    # =========================================================================
    secrets = SecretsCollection()
    
    # สร้างไฟล์ชั่วคราวในโฟลเดอร์โปรเจกต์ปัจจุบันเพื่อเลี่ยง Folder Filter ของ Windows
    with tempfile.NamedTemporaryFile(dir=".", mode="w+", delete=False, suffix=".py", encoding="utf-8") as tmp_file:
        tmp_file.write(current_sanitized_code)
        tmp_file_path = tmp_file.name

    try:
        with default_settings():
            secrets.scan_file(tmp_file_path)

        if tmp_file_path in secrets and secrets[tmp_file_path]:
            for secret in secrets[tmp_file_path]:
                secret_value = secret.secret_value
                
                if secret_value and secret_value not in token_map.values():
                    if not secret_value.startswith(_TOKEN_PREFIX):
                        token = _make_token(secret_value)
                        token_map[token] = secret_value
                        current_sanitized_code = current_sanitized_code.replace(secret_value, token)

    except Exception as exc:
        logger.error(f"detect-secrets scanner error: {exc}")
    finally:
        if os.path.exists(tmp_file_path):
            try:
                os.remove(tmp_file_path)
            except Exception:
                pass

    # =========================================================================
    # ขั้นตอนที่ 3: ส่งข้อมูลกลับเป็นคลาส SanitizationResult 100% เสมอ
    # =========================================================================
    print(f"--- [DEBUG MASKING RESULT] ---")
    print(f"Sanitized code:\n{current_sanitized_code}")
    print(f"Token map: {token_map}")
    print(f"------------------------------")
    
    return SanitizationResult(sanitized_code=current_sanitized_code, token_map=token_map)

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