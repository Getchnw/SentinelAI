import os
import json
import re
import logging
from typing import Any, Optional, Tuple

# นำเข้า litellm ซึ่งเป็นไลบรารีที่รวมการเชื่อมต่อกับหลายค่าย LLM ไว้ในที่เดียว
import litellm
from litellm import acompletion
import httpx

# ตั้งค่า Logger
logger = logging.getLogger(__name__)

# ดึง Config จาก Environment Variables
# ตัวอย่าง:
# LLM_MODEL="ollama/llama3.1" (ใช้ Ollama)
# LLM_MODEL="gpt-4o" (ใช้ OpenAI - ต้องมี OPENAI_API_KEY ใน .env)
LLM_MODEL = os.getenv("LLM_MODEL", "ollama/llama3.1")
print(f"Using LLM Model: {LLM_MODEL}")

# ถ้าใช้ Ollama ต้องตั้งค่า API Base
if LLM_MODEL.startswith("ollama/"):
    os.environ["OLLAMA_API_BASE"] = os.getenv("OLLAMA_URL", "http://localhost:11434")

# ปิดระบบ Logging ยิบย่อยของ litellm
_debug_env = os.getenv("DEBUG", "False").lower()
litellm.set_verbose = _debug_env in ("1", "true", "yes")


def build_prompt(code: str, findings: list[dict[str, Any]], instruction: Optional[str]) -> str:
    """สร้าง Prompt ที่บังคับให้ AI ตอบกลับเป็น JSON"""
    finding_summary = "\n".join(
        [f"- {f.get('check_id', 'unknown')}: {f.get('extra', {}).get('message', '')}" for f in findings]
    )
    
    return (
        "You are a Senior Security Engineer. Analyze the provided code and vulnerabilities.\n"
        "You MUST respond ONLY in valid JSON format with the following exact keys:\n"
        '- "explanation": A brief root cause analysis of the vulnerabilities.\n'
        '- "fixed_code": The complete secured code without any markdown formatting.\n\n'
        f"User instruction: {instruction or 'None'}\n"
        f"Findings:\n{finding_summary}\n\n"
        f"Code:\n{code}\n"
    )

def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    """Parse a JSON object from a string, including double-encoded and wrapped responses."""
    text = raw_text.strip() if isinstance(raw_text, str) else str(raw_text)

    parsed: Any = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"(\{[\s\S]*\})", text)
        if match:
            candidate = match.group(1)
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                # Some providers stringify JSON with escaped quotes inside a larger string.
                # Unescape the quotes once and retry.
                parsed = json.loads(candidate.replace('\\"', '"'))
        else:
            raise

    attempts = 0
    while isinstance(parsed, str) and attempts < 3:
        parsed = json.loads(parsed)
        attempts += 1

    if not isinstance(parsed, dict):
        raise json.JSONDecodeError("Parsed response is not a JSON object", text, 0)

    return parsed

async def _generate_fix_with_ollama(prompt: str) -> Tuple[str, str]:
    """Bypass LiteLLM for Ollama to avoid wrapper-specific response parsing bugs."""
    ollama_base = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    model_name = LLM_MODEL.removeprefix("ollama/")

    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{ollama_base}/api/generate", json=payload)
            response.raise_for_status()
            response_json = response.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Ollama HTTP error (model=%s): %s", LLM_MODEL, exc.response.text[:500])
        return prompt, f"Error: Ollama returned HTTP {exc.response.status_code}."
    except httpx.HTTPError as exc:
        logger.error("Cannot connect to Ollama (model=%s): %s", LLM_MODEL, exc)
        return prompt, f"Error: Cannot connect to Ollama at '{ollama_base}'."

    raw_response = response_json.get("response", "")
    if not raw_response:
        logger.error("Ollama returned empty response payload: %s", response_json)
        return prompt, "Error: AI returned an empty response."

    try:
        parsed_response = _extract_json_payload(raw_response)
    except json.JSONDecodeError:
        logger.error("LLM returned non-JSON response: %.300s", raw_response)
        return prompt, "Error: AI returned an unexpected format. Please try again."

    fixed_code = parsed_response.get("fixed_code") or prompt
    explanation = parsed_response.get("explanation") or "No explanation provided."
    return fixed_code, explanation

async def generate_fix(code: str, findings: list[dict[str, Any]], instruction: Optional[str]) -> Tuple[str, str]:
    """
    ส่งข้อมูลไปให้ AI และรับผลลัพธ์กลับมา
    Args:
        code:        โค้ดต้นฉบับ
        findings:    รายการช่องโหว่
        instruction: คำสั่งพิเศษจากผู้ใช้ (optional)
    """
    prompt = build_prompt(code, findings, instruction)
    
    # รูปแบบ Message ตามมาตรฐาน OpenAI (LiteLLM ใช้โครงสร้างนี้เป็นหลัก)
    messages = [
        {"role": "user", "content": prompt}
    ]

    if LLM_MODEL.startswith("ollama/"):
        return await _generate_fix_with_ollama(prompt)

    raw_response: str = ""
    try:
        # ใช้ acompletion สำหรับ Async (ถ้าเป็น Sync ใช้ completion)
        print("Message:", messages)
        response = await acompletion(
            model=LLM_MODEL,
            messages=messages,
            format="json", # บังคับให้ตอบเป็น JSON
            temperature=0.2 # ลดความสร้างสรรค์ เน้นความถูกต้องของโค้ด
        )
        
        # ดึงข้อความตอบกลับออกมา
        raw_response = response.choices[0].message.tool_calls[0].function.arguments
        
        # แปลง JSON String เป็น Dictionary
        parsed_response = json.loads(raw_response)
        
        fixed_code = parsed_response.get("fixed_code") or code
        explanation = parsed_response.get("explanation") or "No explanation provided."

        return fixed_code, explanation

    # จัดการ Error ผ่าน LiteLLMExceptions ซึ่งรวม Error ของทุกค่ายมาให้แล้ว
    except litellm.exceptions.Timeout:
        logger.error("LLM request timed out (model=%s)", LLM_MODEL)
        return code, "Error: AI engine timed out. Please try again."

    except litellm.exceptions.APIConnectionError:
        logger.error("Cannot connect to LLM provider (model=%s)", LLM_MODEL)
        return code, (
            f"Error: Cannot connect to AI provider '{LLM_MODEL}'. "
            "Please check your API URL or network connection."
        )

    except litellm.exceptions.AuthenticationError:
        logger.error("Authentication failed for model=%s", LLM_MODEL)
        return code, f"Error: Authentication failed for '{LLM_MODEL}'. Please check your API key."

    except json.JSONDecodeError:
        # raw_response มี "" เป็น default แล้ว จึงปลอดภัยที่จะ log
        logger.error("LLM returned non-JSON response: %.200s", raw_response)
        return code, "Error: AI returned an unexpected format. Please try again."

    except Exception:
        # ใช้ logger.exception เพื่อให้ print stack trace อัตโนมัติ
        logger.exception("Unexpected error in generate_fix (model=%s)", LLM_MODEL)
        return code, "An unexpected error occurred in the AI Fix Engine."