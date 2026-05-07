# import os
# import json
# import logging
# from typing import Any, Optional, Tuple
# from dotenv import load_dotenv

# # โหลด Environment Variables
# load_dotenv()

# # นำเข้า litellm ซึ่งเป็นไลบรารีที่รวมการเชื่อมต่อกับหลายค่าย LLM ไว้ในที่เดียว
# import litellm
# from litellm import acompletion

# # ตั้งค่า Logger
# logger = logging.getLogger(__name__)

# # ดึง Config จาก Environment Variables
# # ตัวอย่าง:
# # LLM_MODEL="ollama/llama3.1" (ใช้ Ollama)
# # LLM_MODEL="gemini-1.5-flash" (ใช้ Google Gemini - ต้องมี GOOGLE_API_KEY ใน environment)
# # ในไฟล์ app/services/llm_client.py

# _base_model = os.getenv("LLM_MODEL", "ollama/llama3.1")

# # ตรวจสอบและเติม Provider Prefix ให้ถูกต้อง
# if "/" in _base_model:
#     LLM_MODEL = _base_model
# elif "gemini" in _base_model:
#     LLM_MODEL = f"google/{_base_model}"
# elif "gpt" in _base_model:
#     LLM_MODEL = f"openai/{_base_model}"
# elif "claude" in _base_model:
#     LLM_MODEL = f"anthropic/{_base_model}"
# else:
#     # ถ้าไม่ระบุค่ายและไม่เข้าเงื่อนไข ให้ default ไปที่ ollama
#     LLM_MODEL = f"ollama/{_base_model}"

# logger.info(f"Initialized with model: {LLM_MODEL}")

# # ปิดระบบ Logging ยิบย่อยของ litellm
# litellm.set_verbose = False


# def build_prompt(code: str, findings: list[dict[str, Any]], instruction: Optional[str]) -> str:
#     """สร้าง Prompt ที่บังคับให้ AI ตอบกลับเป็น JSON"""
#     finding_summary = "\n".join(
#         [f"- {f.get('check_id', 'unknown')}: {f.get('extra', {}).get('message', '')}" for f in findings]
#     )
    
#     return (
#         "You are a Senior Security Engineer. Analyze the provided code and vulnerabilities.\n"
#         "You MUST respond ONLY in valid JSON format with the following exact keys:\n"
#         '- "explanation": A brief root cause analysis of the vulnerabilities.\n'
#         '- "fixed_code": The complete secured code without any markdown formatting.\n\n'
#         f"User instruction: {instruction or 'None'}\n"
#         f"Findings:\n{finding_summary}\n\n"
#         f"Code:\n{code}\n"
#     )

# async def generate_fix(code: str, findings: list[dict[str, Any]], instruction: Optional[str]) -> Tuple[str, str]:
#     """
#     ส่งข้อมูลไปให้ AI และรับผลลัพธ์กลับมา
    
#     Args:
#         code:        โค้ดต้นฉบับ
#         findings:    รายการช่องโหว่
#         instruction: คำสั่งพิเศษจากผู้ใช้ (optional)
    
#     Returns:
#         Tuple[str, str]: (fixed_code, explanation)
#         - fixed_code: โค้ดที่ได้รับการแก้ไข หรือโค้ดต้นฉบับหากล้มเหลว
#         - explanation: คำอธิบายหรือข้อความ error
#     """
#     prompt = build_prompt(code, findings, instruction)
    
#     # รูปแบบ Message ตามมาตรฐาน OpenAI (LiteLLM ใช้โครงสร้างนี้เป็นหลัก)
#     messages = [
#         {"role": "user", "content": prompt}
#     ]

#     raw_response: str = ""
    
#     logger.info(f"Calling LLM model: {LLM_MODEL}")
    
#     try:
#         response = await acompletion(
#         model=LLM_MODEL,
#         messages=messages,
#         api_base=os.getenv("OLLAMA_URL", "http://localhost:11434"),
#         custom_llm_provider="ollama", # <--- เพิ่มบรรทัดนี้เพื่อบังคับไม่ให้มันเดา
#         temperature=0.2,
#         format="json"
#     )
        
#         # ดึงข้อความตอบกลับออกมา
#         raw_response = response.choices[0].message.content.strip()
#         logger.debug(f"LLM response length: {len(raw_response)}")
        
#         # แปลง JSON String เป็น Dictionary
#         parsed_response = json.loads(raw_response)
        
#         fixed_code = parsed_response.get("fixed_code") or code
#         explanation = parsed_response.get("explanation") or "No explanation provided."
        
#         logger.info("LLM fix generation succeeded")
#         return fixed_code, explanation

#     # จัดการ Error ผ่าน LiteLLMExceptions ซึ่งรวม Error ของทุกค่ายมาให้แล้ว
#     except litellm.exceptions.Timeout as exc:
#         logger.error(f"LLM request timed out (model={LLM_MODEL}): {exc}")
#         raise RuntimeError(
#             f"AI engine timed out while generating fixes. Please try again later."
#         ) from exc

#     except litellm.exceptions.APIConnectionError as exc:
#         logger.error(f"Cannot connect to LLM provider (model={LLM_MODEL}): {exc}")
#         raise RuntimeError(
#             f"Cannot connect to AI provider '{LLM_MODEL}'. "
#             f"Please check your API URL or network connection."
#         ) from exc

#     except litellm.exceptions.AuthenticationError as exc:
#         logger.error(f"Authentication failed for model={LLM_MODEL}: {exc}")
#         raise RuntimeError(
#             f"Authentication failed for '{LLM_MODEL}'. Please check your API key."
#         ) from exc

#     except litellm.exceptions.RateLimitError as exc:
#         logger.warning(f"Rate limit exceeded for model={LLM_MODEL}: {exc}")
#         raise RuntimeError(
#             f"AI service rate limit exceeded. Please wait a moment and try again."
#         ) from exc

#     except json.JSONDecodeError as exc:
#         # log truncate response เพื่อไม่ให้ log file ใหญ่เกินไป
#         logger.error(f"LLM returned non-JSON response: {raw_response[:300]}... Error: {exc}")
#         raise RuntimeError(
#             f"AI returned an unexpected format. The response was not valid JSON."
#         ) from exc

#     except Exception as exc:
#         # ใช้ logger.exception เพื่อให้ print stack trace อัตโนมัติ
#         logger.exception(f"Unexpected error in generate_fix (model={LLM_MODEL}): {exc}")
#         raise RuntimeError(
#             f"An unexpected error occurred while generating fixes: {exc}"
#         ) from exc

import os
import json
import logging
import re
from typing import Any, Optional, Tuple
from dotenv import load_dotenv

# โหลด Environment Variables
load_dotenv()

# นำเข้า litellm
import litellm
from litellm import acompletion

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

# ปิดระบบ Logging ยิบย่อยของ litellm
litellm.set_verbose = False

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

async def generate_fix(code: str, findings: list[dict[str, Any]], instruction: Optional[str]) -> Tuple[str, str]:
    """ส่งข้อมูลไปให้ AI และรับผลลัพธ์กลับมา"""
    prompt = build_prompt(code, findings, instruction)
    messages = [{"role": "user", "content": prompt}]

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
        raw_response = response.choices[0].message.content.strip()
        
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