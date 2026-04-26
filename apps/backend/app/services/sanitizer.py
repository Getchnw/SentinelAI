from dataclasses import dataclass
import re


@dataclass
class SanitizationResult:
    sanitized_code: str
    token_map: dict[str, str]


SECRET_PATTERN = re.compile(r"(?i)(password\s*=\s*[\"']).+?([\"'])")


def sanitize_code(code: str) -> SanitizationResult:
    token_map: dict[str, str] = {}

    def _replace(match: re.Match) -> str:
        token = f"__SECRET_{len(token_map)}__"
        original = match.group(0)
        token_map[token] = original
        return match.group(0).replace(match.group(1), token)

    sanitized = SECRET_PATTERN.sub(_replace, code)
    return SanitizationResult(sanitized_code=sanitized, token_map=token_map)


def desanitize_code(code: str, token_map: dict[str, str]) -> str:
    restored = code
    for token, original in token_map.items():
        restored = restored.replace(token, original)
    return restored
