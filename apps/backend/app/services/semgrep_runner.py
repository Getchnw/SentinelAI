import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
import asyncio
import shutil

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')

def find_semgrep_executable() -> str:
    # 1. PATH ปกติ
    semgrep = shutil.which("semgrep")
    if semgrep:
        return semgrep

    # 2. Python Scripts (Microsoft Store / local packages)
    possible_paths = [
        Path(sys.executable).parent / "Scripts" / "semgrep.exe",
        Path(sys.executable).parent / "semgrep.exe",
        Path.home() / "AppData/Local/Programs/Python/Python312/Scripts/semgrep.exe",
        Path.home() / "AppData/Roaming/Python/Python312/Scripts/semgrep.exe",
        Path.home() / "AppData/Local/Packages/PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0/LocalCache/local-packages/Python312/Scripts/semgrep.exe",
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    raise RuntimeError("Semgrep executable not found. Please add it to PATH.")


def run_semgrep(code: str, language: str, timeout_seconds: int = 60) -> list[dict]:
    suffix_map = {
        "python": ".py", "py": ".py",
        "javascript": ".js", "js": ".js",
        "typescript": ".ts", "ts": ".ts",
        "java": ".java",
        "go": ".go",
        "csharp": ".cs", "cs": ".cs", "c#": ".cs",
        "php": ".php",
        "ruby": ".rb",
        "cpp": ".cpp", "c++": ".cpp",
        "c": ".c",
    }

    lang_lower = language.lower()
    if lang_lower not in suffix_map:
        raise ValueError(f"Unsupported language: {language}")

    suffix = suffix_map[lang_lower]

    with tempfile.TemporaryDirectory() as tmp_dir:
        file_path = Path(tmp_dir) / f"snippet{suffix}"
        file_path.write_text(code, encoding="utf-8")

        semgrep_cmd = find_semgrep_executable()

        cmd = [
            semgrep_cmd,
            "scan",
            "--config", "auto",
            "--json",
            str(file_path),
        ]

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                check=False,
                env={
                    **os.environ,
                    "PYTHONUTF8": "1",
                },
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Semgrep scan timed out")

        if proc.returncode not in (0, 1):
            raise RuntimeError(proc.stderr.strip() or "Semgrep execution failed")

        try:
            payload = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            raise RuntimeError("Invalid JSON output from Semgrep")

        return payload.get("results", [])


async def run_semgrep_async(code: str, language: str, timeout_seconds: int = 20):
    return await asyncio.to_thread(run_semgrep, code, language, timeout_seconds)