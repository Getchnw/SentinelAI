#!/usr/bin/env python3
"""
SentinelAI Backend API Integration Tests

This script demonstrates how to use the SentinelAI backend API
and includes test cases for various scenarios including error handling.

Usage:
    python test_api.py [--url http://localhost:8000] [--test-name test_name]
"""

import asyncio
import httpx
import json
import sys
from typing import Optional
from datetime import datetime


class SentinelAIAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = []

    @staticmethod
    def _extract_payload(body: object) -> object:
        if isinstance(body, dict) and "detail" in body and isinstance(body["detail"], dict):
            return body["detail"]
        return body

    @staticmethod
    def _get_errors(payload: object) -> list[dict]:
        if isinstance(payload, dict):
            errors = payload.get("errors", [])
            return errors if isinstance(errors, list) else []
        return []

    async def test_health(self) -> bool:
        """Test health endpoint"""
        print("\n" + "=" * 70)
        print("TEST: Health Check")
        print("=" * 70)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/v1/health")
                print(f"Status: {response.status_code}")
                print(f"Response: {response.json()}")
                
                success = response.status_code == 200
                self.results.append(("Health Check", success))
                return success
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("Health Check", False))
            return False

    async def test_valid_scan(self) -> bool:
        """Test scanning valid Python code"""
        print("\n" + "=" * 70)
        print("TEST: Valid Python Code Scan")
        print("=" * 70)
        
        payload = {
            "request_id": "test-valid-001",
            "language": "python",
            "file_path": "src/app.py",
            "code_snippet": """
import os
import sqlite3

# Vulnerable: SQL injection
user_id = input("Enter ID: ")
db = sqlite3.connect(":memory:")
query = f"SELECT * FROM users WHERE id = {user_id}"  # VULNERABLE!
result = db.execute(query)

# Vulnerable: Hardcoded password
PASSWORD = "admin123456"
""",
            "user_instruction": "Focus on SQL injection and hardcoded credentials"
        }
        
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{self.base_url}/v1/scan-fix",
                    json=payload
                )
                
                print(f"Status: {response.status_code}")
                raw_body = response.json()
                data = self._extract_payload(raw_body)
                
                print(f"\nResponse Summary:")
                if isinstance(data, dict):
                    print(f"  Status: {data.get('status')}")
                    print(f"  Findings: {len(data.get('findings', []))} vulnerabilities found")
                    print(f"  Timings: Semgrep={data.get('timings_ms', {}).get('semgrep')}ms, "
                          f"LLM={data.get('timings_ms', {}).get('llm')}ms")
                else:
                    print(f"  Unexpected payload: {data}")
                
                if isinstance(data, dict) and data.get('findings'):
                    print(f"\n  Findings:")
                    for finding in data['findings']:
                        print(f"    - [{finding['severity'].upper()}] {finding['rule_id']}")
                        print(f"      Message: {finding['message']}")
                
                if isinstance(data, dict) and data.get('errors'):
                    print(f"\n  Errors:")
                    for error in data['errors']:
                        print(f"    - [{error['source']}] {error['code']}: {error['detail'][:100]}")
                
                if isinstance(data, dict) and data.get('explanation'):
                    print(f"\nGemini Analysis:")
                    print(f"{data.get('explanation')}")
                
                if isinstance(data, dict) and data.get('fixed_code'):
                    print(f"\nFixed Code:")
                    print(f"{data.get('fixed_code')}")
                
                success = (
                    response.status_code == 200
                    and isinstance(data, dict)
                    and data.get('status') in {'ok', 'partial_success'}
                    and len(data.get('findings', [])) > 0
                )
                self.results.append(("Valid Scan", success))
                return success
                
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("Valid Scan", False))
            return False

    async def test_empty_code(self) -> bool:
        """Test validation: empty code snippet"""
        print("\n" + "=" * 70)
        print("TEST: Empty Code Validation Error")
        print("=" * 70)
        
        payload = {
            "request_id": "test-empty-001",
            "language": "python",
            "file_path": "test.py",
            "code_snippet": ""
        }
        
        try:
            async with httpx.AsyncClient(timeout=180.0 ) as client:
                response = await client.post(
                    f"{self.base_url}/v1/scan-fix",
                    json=payload
                )
                
                print(f"Status: {response.status_code}")
                data = response.json()
                print(f"Response body: {data}")
                
                if isinstance(data, dict) and data.get('detail'):
                    print(f"Detail: {data['detail']}")
                
                # FastAPI/Pydantic rejects empty strings before reaching the route.
                success = response.status_code == 422
                self.results.append(("Empty Code Validation", success))
                return success
                
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("Empty Code Validation", False))
            return False

    async def test_unsupported_language(self) -> bool:
        """Test validation: unsupported language"""
        print("\n" + "=" * 70)
        print("TEST: Unsupported Language Error")
        print("=" * 70)
        
        payload = {
            "request_id": "test-lang-001",
            "language": "cobol",
            "file_path": "legacy.cbl",
            "code_snippet": "DISPLAY 'Hello World'."
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v1/scan-fix",
                    json=payload
                )
                
                print(f"Status: {response.status_code}")
                raw_body = response.json()
                data = self._extract_payload(raw_body)
                print(f"Response body: {raw_body}")
                
                errors = self._get_errors(data)
                if errors:
                    print(f"Error Details: {errors[0]['detail']}")
                
                # Expected: 400 status with validation error
                success = (
                    response.status_code == 400
                    and isinstance(data, dict)
                    and data.get('status') == 'error'
                )
                self.results.append(("Unsupported Language", success))
                return success
                
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("Unsupported Language", False))
            return False

    async def test_no_vulnerabilities(self) -> bool:
        """Test code with no vulnerabilities"""
        print("\n" + "=" * 70)
        print("TEST: Secure Code (No Vulnerabilities)")
        print("=" * 70)
        
        payload = {
            "request_id": "test-secure-001",
            "language": "python",
            "file_path": "secure.py",
            "code_snippet": """
import logging

logger = logging.getLogger(__name__)

def greet(name: str) -> str:
    '''Safely greet a person'''
    if not isinstance(name, str):
        raise ValueError("Name must be a string")
    return f"Hello, {name}!"

if __name__ == "__main__":
    logger.info(greet("Alice"))
"""
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/v1/scan-fix",
                    json=payload
                )
                
                print(f"Status: {response.status_code}")
                raw_body = response.json()
                data = self._extract_payload(raw_body)
                
                if isinstance(data, dict):
                    print(f"Status: {data.get('status')}")
                    print(f"Findings: {len(data.get('findings', []))} vulnerabilities")
                    print(f"Explanation: {data.get('explanation')}")
                
                success = (
                    response.status_code == 200 and 
                    isinstance(data, dict) and
                    data.get('status') == 'ok' and
                    len(data.get('findings', [])) == 0
                )
                self.results.append(("Secure Code", success))
                return success
                
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("Secure Code", False))
            return False

    async def test_large_code(self) -> bool:
        """Test code size limit"""
        print("\n" + "=" * 70)
        print("TEST: Code Size Limit Validation")
        print("=" * 70)
        
        # Generate code > 1 MB so the backend size check is actually triggered
        large_code = ("# Comment\n" * 100_001)
        
        payload = {
            "request_id": "test-large-001",
            "language": "python",
            "file_path": "large.py",
            "code_snippet": large_code
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v1/scan-fix",
                    json=payload
                )
                
                print(f"Status: {response.status_code}")
                data = response.json()
                print(f"Response body: {data}")
                
                # Expected: 400 status from route-level validation
                success = response.status_code == 400
                self.results.append(("Code Size Limit", success))
                return success
                
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("Code Size Limit", False))
            return False

    async def test_javascript_scan(self) -> bool:
        """Test scanning JavaScript code"""
        print("\n" + "=" * 70)
        print("TEST: JavaScript Code Scan")
        print("=" * 70)
        
        payload = {
            "request_id": "test-js-001",
            "language": "javascript",
            "file_path": "src/app.js",
            "code_snippet": """
const express = require('express');
const app = express();

app.get('/user/:id', (req, res) => {
    // Vulnerable: SQL injection
    const query = "SELECT * FROM users WHERE id = " + req.params.id;
    db.query(query, (err, result) => {
        res.json(result);
    });
});

// Vulnerable: XSS
app.get('/api/search', (req, res) => {
    const output = "<h1>" + req.query.search + "</h1>";
    res.send(output);
});
"""
        }
        
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{self.base_url}/v1/scan-fix",
                    json=payload
                )
                
                print(f"Status: {response.status_code}")
                raw_body = response.json()
                data = self._extract_payload(raw_body)
                
                if isinstance(data, dict):
                    print(f"Status: {data.get('status')}")
                    print(f"Findings: {len(data.get('findings', []))} vulnerabilities")
                
                if isinstance(data, dict) and data.get('findings'):
                    print("\nVulnerabilities found:")
                    for finding in data['findings']:  # Show all findings
                        print(f"  - Rule: {finding['rule_id']}")
                        print(f"    Message: {finding['message']}")
                        print(f"    Severity: {finding['severity']}")
                
                if isinstance(data, dict) and data.get('explanation'):
                    print(f"\nGemini Analysis:")
                    print(f"{data.get('explanation')}")
                
                if isinstance(data, dict) and data.get('fixed_code'):
                    print(f"\nFixed Code:")
                    print(f"{data.get('fixed_code')}")
                
                success = (
                    response.status_code == 200 and
                    isinstance(data, dict) and
                    data.get('status') in {'ok', 'partial_success'} and
                    len(data.get('findings', [])) > 0
                )
                self.results.append(("JavaScript Scan", success))
                return success
                
        except Exception as e:
            print(f"ERROR: {e}")
            self.results.append(("JavaScript Scan", False))
            return False

    async def run_all_tests(self):
        """Run all tests"""
        print("\n" + "=" * 70)
        print("SentinelAI Backend API Test Suite")
        print(f"Base URL: {self.base_url}")
        print(f"Started: {datetime.now().isoformat()}")
        print("=" * 70)
        
        await self.test_health()
        await self.test_empty_code()
        await self.test_unsupported_language()
        await self.test_large_code()
        await self.test_no_vulnerabilities()
        await self.test_valid_scan()
        await self.test_javascript_scan()
        
        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        
        for test_name, success in self.results:
            status = "[PASS]" if success else "[FAIL]"
            print(f"{status:8} {test_name}")
        
        passed = sum(1 for _, success in self.results if success)
        total = len(self.results)
        
        print(f"\nTotal: {passed}/{total} tests passed")
        print("=" * 70)


async def main():
    base_url = "http://localhost:8000"
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        for i, arg in enumerate(sys.argv[1:]):
            if arg == "--url" and i + 2 < len(sys.argv):
                base_url = sys.argv[i + 2]
    
    tester = SentinelAIAPITester(base_url)
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
