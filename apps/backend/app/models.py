from pydantic import BaseModel, Field
from typing import List, Optional


class ScanFixRequest(BaseModel):
    request_id: str = Field(min_length=1)
    language: str = Field(min_length=1)
    file_path: str = Field(min_length=1)
    code_snippet: str = Field(min_length=1)
    user_instruction: Optional[str] = None


class Finding(BaseModel):
    rule_id: str
    severity: str
    message: str
    start_line: int
    end_line: int


class ServiceError(BaseModel):
    source: str
    code: str
    detail: str


class ScanFixResponse(BaseModel):
    request_id: str
    status: str
    findings: List[Finding]
    fixed_code: str
    explanation: str
    timings_ms: dict
    errors: List[ServiceError] = []
