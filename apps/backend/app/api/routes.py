import logging
import time
from fastapi import APIRouter, HTTPException

from app.models import Finding, ScanFixRequest, ScanFixResponse, ServiceError
from app.services.llm_client import generate_fix
from app.services.sanitizer import sanitize_code, desanitize_code
from app.services.semgrep_runner import run_semgrep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["scan-fix"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/scan-fix", response_model=ScanFixResponse)
async def scan_fix(payload: ScanFixRequest) -> ScanFixResponse:
    semgrep_start = time.perf_counter()
    llm_start = 0.0

    try:
        # 1. Sanitize & Scan
        sanitized = sanitize_code(payload.code_snippet)
        semgrep_results = run_semgrep(sanitized.sanitized_code, payload.language)
        semgrep_ms = int((time.perf_counter() - semgrep_start) * 1000)

        # แปลงผลลัพธ์ Semgrep เป็น Pydantic Model
        findings = [
            Finding(
                rule_id=item.get("check_id", "unknown"),
                severity=item.get("extra", {}).get("severity", "warning").lower(),
                message=item.get("extra", {}).get("message", "Potential issue"),
                start_line=item.get("start", {}).get("line", 1),
                end_line=item.get("end", {}).get("line", 1),
            )
            for item in semgrep_results
        ]

        # ถ้าไม่พบช่องโหว่เลย ไม่ต้องเรียก LLM ให้เสียเวลา
        # ประหยัดค่าใช้จ่ายและลด latency
        if not findings:
            logger.info(f"[{payload.request_id}] No vulnerabilities found. Skipping LLM.")
            return ScanFixResponse(
                request_id=payload.request_id,
                status="ok",
                findings=[],
                fixed_code=payload.code_snippet, # คืนโค้ดต้นฉบับกลับไปเลย
                explanation="No vulnerabilities detected. Your code looks secure!",
                timings_ms={"semgrep": semgrep_ms, "llm": 0},
                errors=[],
            )

        # 2. LLM Fix (ทำเฉพาะเมื่อเจอช่องโหว่)
        llm_start = time.perf_counter()
        fixed_sanitized, explanation = await generate_fix(
            sanitized.sanitized_code,
            semgrep_results,
            payload.user_instruction,
        )
        llm_ms = int((time.perf_counter() - llm_start) * 1000)

        # 3. Desanitize
        fixed_code = desanitize_code(fixed_sanitized, sanitized.token_map)

        return ScanFixResponse(
            request_id=payload.request_id,
            status="ok",
            findings=findings,
            fixed_code=fixed_code,
            explanation=explanation,
            timings_ms={"semgrep": semgrep_ms, "llm": llm_ms},
            errors=[],
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=ServiceError(source="validation", code="INVALID_INPUT", detail=str(exc)).model_dump(),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=ServiceError(source="system", code="PROCESSING_FAILED", detail=str(exc)).model_dump(),
        ) from exc
