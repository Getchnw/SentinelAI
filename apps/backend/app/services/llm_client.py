import os
import json
import re
import logging
import re
from typing import Any, Optional, Tuple
from dotenv import load_dotenv

# โหลด Environment Variables
load_dotenv()

# นำเข้า litellm
import litellm
from litellm import acompletion
import httpx

# ตั้งค่า Logger
logger = logging.getLogger(__name__)

# ดึง Config จาก Environment Variables
_base_model = os.getenv("LLM_MODEL", "ollama/qwen2.5-coder:7b")

# ตรวจสอบและเติม Provider Prefix ให้ถูกต้อง
if "/" in _base_model:
    LLM_MODEL = _base_model
elif "gemini" in _base_model:
    LLM_MODEL = f"google/{_base_model}"
elif "gpt" in _base_model:
    LLM_MODEL = f"openai/{_base_model}"
elif "claude" in _base_model:
    LLM_MODEL = f"anthropic/{_base_model}"
else:
    LLM_MODEL = f"ollama/{_base_model}"

logger.info(f"Initialized with model: {LLM_MODEL}")
print(f"Using LLM model: {LLM_MODEL}")

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
    print(f"Raw response from Ollama: {raw_response}")
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
    """ส่งข้อมูลไปให้ AI และรับผลลัพธ์กลับมา"""
    prompt = build_prompt(code, findings, instruction)
    messages = [{"role": "user", "content": prompt}]

    if LLM_MODEL.startswith("ollama/"):
        return await _generate_fix_with_ollama(prompt)

    raw_response: str = ""
    logger.info(f"Calling LLM model: {LLM_MODEL}")
    
    try:
        # แก้ไข Indentation และเรียก Ollama
        response = await acompletion(
            model=LLM_MODEL,
            messages=messages,
            api_base=os.getenv("OLLAMA_URL", "http://localhost:11434"),
            custom_llm_provider="ollama" if "ollama" in LLM_MODEL else None,
            temperature=0.2,
            format="json" # บังคับ JSON สำหรับ Ollama
        )
        
        # ดึงข้อความตอบกลับ
        raw_response = response.choices[0].message.tool_calls[0].function.arguments
        
        # --- ส่วนที่เพิ่ม: ล้าง Markdown Code Blocks (ป้องกัน JSON พัง) ---
        clean_json = re.sub(r'^```json\s*|```$', '', raw_response, flags=re.MULTILINE).strip()
        
        # แปลง JSON String เป็น Dictionary
        parsed_response = json.loads(clean_json)
        
        fixed_code = parsed_response.get("fixed_code") or code
        explanation = parsed_response.get("explanation") or "No explanation provided."
        
        logger.info("LLM fix generation succeeded")
        return fixed_code, explanation

    except litellm.exceptions.Timeout as exc:
        logger.error(f"LLM request timed out: {exc}")
        raise RuntimeError("AI engine timed out. Please try again.") from exc

    except litellm.exceptions.APIConnectionError as exc:
        logger.error(f"Cannot connect to Ollama: {exc}")
        raise RuntimeError("Cannot connect to Ollama. Make sure the app is running.") from exc

    except json.JSONDecodeError as exc:
        logger.error(f"LLM returned non-JSON: {raw_response[:300]}")
        raise RuntimeError("AI returned an invalid JSON format.") from exc

    except Exception as exc:
        logger.exception(f"Unexpected error: {exc}")
        raise RuntimeError(f"An unexpected error occurred: {exc}") from exc