import asyncio
import json
import os
from pathlib import Path
import unittest

os.environ["NEURON_EXPLORER_STATIC_DIR"] = str(Path(__file__).resolve().parents[1] / "neurons")
os.environ["NEURON_GATEWAY_ALLOWED_USERS"] = "owner@example.test"

import httpx
import gateway


class BrowserGatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.forwarded = []

        def upstream(request):
            self.forwarded.append(request)
            payload = json.dumps({"status": "ready"}).encode()
            return httpx.Response(200, headers={"Content-Type": "application/json", "X-Web-Total": "5"}, stream=httpx.ByteStream(payload))

        gateway._client = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
        gateway._rate_events.clear()
        gateway._gpu_lock = asyncio.Lock()
        gateway._rate_lock = asyncio.Lock()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=gateway.app), base_url="https://spark.example.test")
        self.headers = {
            "Tailscale-User-Login": "owner@example.test",
            "Origin": gateway.FRONTEND_ORIGIN,
            "Sec-Fetch-Site": "cross-site",
        }

    async def asyncTearDown(self):
        await self.client.aclose()
        await gateway._client.aclose()
        gateway._client = None

    async def test_website_can_read_and_access_binary_metadata(self):
        response = await self.client.get("/api/index", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], gateway.FRONTEND_ORIGIN)
        self.assertIn("X-Web-Total", response.headers["access-control-expose-headers"])
        self.assertEqual(response.headers["x-web-total"], "5")
        self.assertEqual(len(self.forwarded), 1)
        self.assertNotIn("tailscale-user-login", self.forwarded[0].headers)

    async def test_private_network_preflight_and_inference(self):
        response = await self.client.options("/api/infer", headers={**self.headers,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
            "Access-Control-Request-Private-Network": "true",
        })
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.headers["access-control-allow-private-network"], "true")
        self.assertEqual(self.forwarded, [])
        response = await self.client.post("/api/infer", headers=self.headers, json={"text": "Hello", "unexpected": "removed"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(self.forwarded[0].content), {"text": "Hello", "chat": False})

    async def test_identity_is_required_for_requests_and_preflight(self):
        for method in ("GET", "OPTIONS"):
            response = await self.client.request(method, "/api/index", headers={"Origin": gateway.FRONTEND_ORIGIN, "Access-Control-Request-Method": "GET"})
            self.assertEqual(response.status_code, 401)
        self.assertEqual(self.forwarded, [])

    async def test_other_origins_are_rejected(self):
        for origin in ("https://example.com", "null", gateway.FRONTEND_ORIGIN + ".example.com"):
            for method in ("GET", "OPTIONS"):
                response = await self.client.request(method, "/api/index", headers={**self.headers, "Origin": origin, "Access-Control-Request-Method": "GET"})
                self.assertEqual(response.status_code, 403)
                self.assertNotIn("access-control-allow-origin", response.headers)
        self.assertEqual(self.forwarded, [])

    async def test_agent_writes_and_unsupported_methods_stay_blocked(self):
        for route in ("/api/agent/send", "/api/agent/upload", "/api/name"):
            for method in ("POST", "OPTIONS"):
                response = await self.client.request(method, route, headers={**self.headers, "Access-Control-Request-Method": "POST"}, json={})
                self.assertEqual(response.status_code, 404)
        response = await self.client.options("/api/index", headers={**self.headers, "Access-Control-Request-Method": "DELETE"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.forwarded, [])

    async def test_identity_headers_cannot_be_set_by_website(self):
        response = await self.client.options("/api/infer", headers={**self.headers,
            "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type, Tailscale-User-Login"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.forwarded, [])

    async def test_original_same_origin_viewer_still_works(self):
        response = await self.client.get("/api/index", headers={**self.headers, "Origin": "https://spark.example.test", "Sec-Fetch-Site": "same-origin"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("access-control-allow-origin", response.headers)

    async def test_body_limits_still_apply(self):
        response = await self.client.post("/api/infer", headers=self.headers, content=b"x" * (gateway.MAX_BODY_BYTES + 1))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.forwarded, [])


if __name__ == "__main__":
    unittest.main()
