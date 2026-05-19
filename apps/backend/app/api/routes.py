import logging
import time
from fastapi import APIRouter, HTTPException, status

from app.models import Finding, ScanFixRequest, ScanFixResponse, ServiceError
from app.services.llm_client import generate_fix
from app.services.sanitizer import sanitize_code, desanitize_code
from app.services.semgrep_runner import run_semgrep_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["scan-fix"])

# รายการภาษาที่รองรับ
SUPPORTED_LANGUAGES = {
    "python", "py",
    "javascript", "js", "ts", "typescript",
    "java", "go", "csharp", "c#", "cs",
    "php", "ruby", "cpp", "c++", "c"
}


def validate_code_snippet(code: str) -> None:
    """
    ตรวจสอบความถูกต้องของโค้ด snippet
    Raises: ValueError หากไม่ผ่านการตรวจสอบ
    """
    if not code or not code.strip():
        raise ValueError("Code snippet cannot be empty")
    
    if len(code) > 1_000_000:  # 1 MB limit
        raise ValueError("Code snippet exceeds maximum size (1 MB)")
    
    # ตรวจสอบว่ามีอักขระที่ไม่ถูกต้อง
    if any(char for char in code if ord(char) < 0x20 and char not in '\n\r\t'):
        raise ValueError("Code contains invalid control characters")


def validate_language(language: str) -> str:
    """
    ตรวจสอบและนอร์มัลไลซ์ชื่อภาษา
    Raises: ValueError หากภาษาไม่รองรับ
    Returns: ชื่อภาษาที่นอร์มัลไลซ์
    """
    lang_normalized = language.lower().strip()
    
    if not lang_normalized:
        raise ValueError("Language must be specified")
    
    # แปลง alias (เช่น js → javascript, ts → typescript)
    language_map = {
        "js": "javascript",
        "ts": "typescript",
        "py": "python",
        "cs": "csharp",
        "c#": "csharp",
        "cpp": "c++",
    }
    
    lang_normalized = language_map.get(lang_normalized, lang_normalized)
    
    if lang_normalized not in SUPPORTED_LANGUAGES:
        raise ValueError(
            f"Language '{language}' is not supported. "
            f"Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
        )
    
    return lang_normalized


@router.get("/health")
def health() -> dict:
    """ตรวจสอบสถานะของ Backend"""
    return {"status": "ok"}


@router.post("/scan-fix", response_model=ScanFixResponse)
async def scan_fix(payload: ScanFixRequest) -> ScanFixResponse:
    """
    สแกนโค้ดหาช่องโหว่และสร้างการแก้ไขโดยใช้ AI
    
    Request:
        - request_id: ID สำหรับติดตามการขอ
        - language: ภาษาของโค้ด (python, javascript, java, etc.)
        - file_path: เส้นทางไฟล์ (สำหรับบริบท)
        - code_snippet: โค้ดที่ต้องการสแกน
        - user_instruction: คำแนะนำเพิ่มเติม (optional)
    
    Response:
        - status: สถานะการประมวลผล (ok, partial_success, error)
        - findings: รายการช่องโหว่ที่พบ
        - fixed_code: โค้ดที่ได้รับการแก้ไข
        - explanation: คำอธิบายการแก้ไข
        - timings_ms: เวลาการประมวลผล
        - errors: รายการ error ที่เกิดขึ้น
    """
    print(f"Received request: {payload.request_id} for language: {payload.language}")
    semgrep_start = time.perf_counter()
    llm_start = 0.0
    errors: list[ServiceError] = []
    
    try:
        # ===== ขั้นตอนที่ 1: ตรวจสอบ Input =====
        try:
            validate_code_snippet(payload.code_snippet)
            language = validate_language(payload.language)
        except ValueError as exc:
            logger.warning(f"[{payload.request_id}] Validation failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "request_id": payload.request_id,
                    "status": "error",
                    "findings": [],
                    "fixed_code": "",
                    "explanation": str(exc),
                    "timings_ms": {"semgrep": 0, "llm": 0},
                    "errors": [
                        {
                            "source": "validation",
                            "code": "INVALID_INPUT",
                            "detail": str(exc)
                        }
                    ]
                }
            )

        # ===== ขั้นตอนที่ 2: Sanitize โค้ด =====
        try:
            sanitized = sanitize_code(payload.code_snippet)
            # sanitized = scan_with_regex(payload.code_snippet)
            print(f"Sanitized code:\n{sanitized.sanitized_code}\nToken map: {sanitized.token_map}")
            logger.debug(f"[{payload.request_id}] Code sanitized. Secrets masked: {len(sanitized.token_map)}")
        except Exception as exc:
            logger.error(f"[{payload.request_id}] Sanitization failed: {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "request_id": payload.request_id,
                    "status": "error",
                    "findings": [],
                    "fixed_code": "",
                    "explanation": "Failed to sanitize code",
                    "timings_ms": {"semgrep": 0, "llm": 0},
                    "errors": [
                        {
                            "source": "sanitizer",
                            "code": "SANITIZATION_FAILED",
                            "detail": str(exc)
                        }
                    ]
                }
            )

        # ===== ขั้นตอนที่ 3: รัน Semgrep =====
        try:
            semgrep_results = await run_semgrep_async(sanitized.sanitized_code, language, timeout_seconds=120)
            semgrep_ms = int((time.perf_counter() - semgrep_start) * 1000)
            logger.info(f"[{payload.request_id}] Semgrep completed in {semgrep_ms}ms. Findings: {len(semgrep_results)}")
        except TimeoutError as exc:
            semgrep_ms = int((time.perf_counter() - semgrep_start) * 1000)
            logger.error(f"[{payload.request_id}] Semgrep timeout after {semgrep_ms}ms")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={
                    "request_id": payload.request_id,
                    "status": "error",
                    "findings": [],
                    "fixed_code": "",
                    "explanation": "Vulnerability scanning timed out. The code snippet might be too large or the scanner is unavailable.",
                    "timings_ms": {"semgrep": semgrep_ms, "llm": 0},
                    "errors": [
                        {
                            "source": "semgrep",
                            "code": "TIMEOUT",
                            "detail": str(exc)
                        }
                    ]
                }
            )
        except RuntimeError as exc:
            semgrep_ms = int((time.perf_counter() - semgrep_start) * 1000)
            logger.error(f"[{payload.request_id}] Semgrep execution failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "request_id": payload.request_id,
                    "status": "error",
                    "findings": [],
                    "fixed_code": "",
                    "explanation": "Vulnerability scanner failed. This may be due to invalid syntax or unsupported code patterns.",
                    "timings_ms": {"semgrep": semgrep_ms, "llm": 0},
                    "errors": [
                        {
                            "source": "semgrep",
                            "code": "EXECUTION_FAILED",
                            "detail": str(exc)
                        }
                    ]
                }
            )

        # ===== ขั้นตอนที่ 4: แปลง Semgrep Results เป็น Finding Objects =====
        findings = []
        try:
            for item in semgrep_results:
                try:
                    finding = Finding(
                        rule_id=item.get("check_id", "unknown"),
                        severity=item.get("extra", {}).get("severity", "warning").lower(),
                        message=item.get("extra", {}).get("message", "Potential issue"),
                        start_line=item.get("start", {}).get("line", 1),
                        end_line=item.get("end", {}).get("line", 1),
                    )
                    findings.append(finding)
                except Exception as exc:
                    logger.warning(f"[{payload.request_id}] Failed to parse finding: {exc}")
                    errors.append(ServiceError(
                        source="parser",
                        code="FINDING_PARSE_ERROR",
                        detail=f"Could not parse finding: {exc}"
                    ))
        except Exception as exc:
            logger.error(f"[{payload.request_id}] Finding conversion failed: {exc}", exc_info=True)
            errors.append(ServiceError(
                source="parser",
                code="FINDINGS_CONVERSION_ERROR",
                detail=str(exc)
            ))

        # ===== ขั้นตอนที่ 5: หากไม่พบช่องโหว่ ส่งผลลัพธ์กลับทันที =====
        if not findings:
            logger.info(f"[{payload.request_id}] No vulnerabilities found. Skipping LLM.")
            # return ScanFixResponse(
            #     request_id=payload.request_id,
            #     status="ok",
            #     findings=[],
            #     original_code=payload.code_snippet,
            #     fixed_code=payload.code_snippet,
            #     explanation="✓ No vulnerabilities detected. Your code looks secure!",
            #     timings_ms={"semgrep": semgrep_ms, "llm": 0},
            #     errors=errors,
            # )

        # ===== ขั้นตอนที่ 6: เรียก LLM เพื่อสร้างการแก้ไข =====
        llm_ms = 0
        fixed_code = payload.code_snippet
        explanation = "Unable to generate fix: LLM service unavailable."
        errors = []
        llm_start = time.perf_counter()
        try:
            fixed_sanitized, explanation = await generate_fix(
                sanitized.sanitized_code,
                semgrep_results,
                payload.user_instruction,
            )
            llm_ms = int((time.perf_counter() - llm_start) * 1000)
            logger.info(f"[{payload.request_id}] LLM completed in {llm_ms}ms")
        except RuntimeError as exc:
            llm_ms = int((time.perf_counter() - llm_start) * 1000)
            logger.error(f"[{payload.request_id}] LLM failed: {exc}", exc_info=True)
            # ถ้า LLM ล้มเหลว ยังคงส่ง Findings กลับแม้ว่าจะไม่มี fixed code
            return ScanFixResponse(
                request_id=payload.request_id,
                status="partial_success",
                findings=findings,
                fixed_code="",  # ไม่สามารถสร้าง fixed code ได้
                explanation=f"⚠ Found {len(findings)} vulnerabilities but failed to generate fixes: {str(exc)}",
                timings_ms={"semgrep": semgrep_ms, "llm": llm_ms},
                errors=[
                    ServiceError(
                        source="llm",
                        code="GENERATION_FAILED",
                        detail=str(exc)
                    ),
                    *errors
                ]
            )
        except Exception as exc:
            llm_ms = int((time.perf_counter() - llm_start) * 1000)
            logger.error(f"[{payload.request_id}] LLM unexpected error: {exc}", exc_info=True)
            # ถ้า LLM ล้มเหลว ยังคงส่ง Findings กลับแม้ว่าจะไม่มี fixed code
            return ScanFixResponse(
                request_id=payload.request_id,
                status="partial_success",
                findings=findings,
                fixed_code="",  # ไม่สามารถสร้าง fixed code ได้
                explanation=f"⚠ Found {len(findings)} vulnerabilities but failed to generate fixes: {str(exc)}",
                timings_ms={"semgrep": semgrep_ms, "llm": llm_ms},
                errors=[
                    ServiceError(
                        source="llm",
                        code="GENERATION_FAILED",
                        detail=str(exc)
                    ),
                    *errors
                ]
            )

        # ===== ขั้นตอนที่ 7: Desanitize โค้ดที่แก้ไข =====
        try:
            fixed_code = desanitize_code(fixed_sanitized, sanitized.token_map)
            logger.debug(f"[{payload.request_id}] Code desanitized")
        except Exception as exc:
            logger.error(f"[{payload.request_id}] Desanitization failed: {exc}", exc_info=True)
            fixed_code = fixed_sanitized  # ใช้โค้ดที่แก้ไขแบบ sanitized แถมท้อง
            errors.append(ServiceError(
                source="sanitizer",
                code="DESANITIZATION_FAILED",
                detail=str(exc)
            ))

        # ===== ส่งผลลัพธ์ที่สำเร็จ =====
        logger.info(
            f"[{payload.request_id}] Scan completed successfully. "
            f"Findings: {len(findings)}, Semgrep: {semgrep_ms}ms, LLM: {llm_ms}ms"
        )
        return ScanFixResponse(
            request_id=payload.request_id,
            status="partial" if errors else "ok",
            findings=findings,
            original_code=payload.code_snippet,
            fixed_code=fixed_code,
            explanation=explanation,
            timings_ms={"semgrep": semgrep_ms, "llm": llm_ms},
            errors=errors,
        )

    except HTTPException:
        # Re-raise HTTPException (validation/scanner errors)
        raise

    except Exception as exc:
        # Catch-all for unexpected errors
        semgrep_ms = int((time.perf_counter() - semgrep_start) * 1000)
        logger.error(f"[{payload.request_id}] Unexpected error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "request_id": payload.request_id,
                "status": "error",
                "findings": [],
                "fixed_code": "",
                "explanation": "An unexpected error occurred during processing",
                "timings_ms": {"semgrep": semgrep_ms, "llm": 0},
                "errors": [
                    {
                        "source": "system",
                        "code": "UNEXPECTED_ERROR",
                        "detail": str(exc)
                    }
                ]
            }
        ) from exc
