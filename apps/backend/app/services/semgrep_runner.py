import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run_semgrep(code: str, language: str, timeout_seconds: int = 20) -> list[dict]:
    suffix_map = {
        "python": ".py",
        "javascript": ".js",
        "typescript": ".ts",
        "java": ".java",
        "go": ".go",
        "csharp": ".cs",
    }
    suffix = suffix_map.get(language.lower(), ".txt")

    with tempfile.TemporaryDirectory() as tmp_dir:
        file_path = Path(tmp_dir) / f"snippet{suffix}"
        file_path.write_text(code, encoding="utf-8")

        semgrep_in_path = shutil.which("semgrep")
        venv_semgrep = Path(sys.executable).resolve().parent / (
            "semgrep.exe" if sys.platform.startswith("win") else "semgrep"
        )
        semgrep_cmd = semgrep_in_path or str(venv_semgrep)

        cmd = [
            semgrep_cmd,
            "scan",
            "--config",
            "auto",
            "--json",
            str(file_path),
        ]

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
                "PYTHONIOENCODING": "utf-8",
            },
        )

        if proc.returncode not in (0, 1):
            raise RuntimeError((proc.stderr or "").strip() or "Semgrep failed")

        payload = json.loads(proc.stdout or "{}")
        return payload.get("results", [])
