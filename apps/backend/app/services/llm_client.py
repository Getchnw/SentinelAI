import os
import json
import logging
from typing import Any, Optional, Tuple

# นำเข้า litellm ซึ่งเป็นไลบรารีที่รวมการเชื่อมต่อกับหลายค่าย LLM ไว้ในที่เดียว
import litellm
from litellm import acompletion

# ตั้งค่า Logger
logger = logging.getLogger(__name__)

# ดึง Config จาก Environment Variables
# ตัวอย่าง:
# LLM_MODEL="ollama/llama3.1" (ใช้ Ollama)
# LLM_MODEL="gpt-4o" (ใช้ OpenAI - ต้องมี OPENAI_API_KEY ใน .env)
LLM_MODEL = os.getenv("LLM_MODEL", "ollama/llama3.1")

# ถ้าใช้ Ollama ต้องตั้งค่า API Base
if LLM_MODEL.startswith("ollama/"):
    os.environ["OLLAMA_API_BASE"] = os.getenv("OLLAMA_URL", "http://localhost:11434")

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

    raw_response: str = ""
    try:
        # ใช้ acompletion สำหรับ Async (ถ้าเป็น Sync ใช้ completion)
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