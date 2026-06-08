# Klikatko Redis Bridge

Read-only local helper for Klikatko. It exposes selected Redis values over HTTP so the browser UI can inspect the PID Litacka backend MOS session cache.

## Run

```powershell
$env:REDIS_CONNECTION_STRING="localhost:6379,abortConnect=false"
node tools/redis-bridge/src/server.js
```

Default endpoint: `http://127.0.0.1:5097`.

## Configuration

Copy `.env.example` to `.env` for local overrides. The file is ignored by git.

Supported variables:

- `REDIS_BRIDGE_PORT` - default `5097`
- `REDIS_CONNECTION_STRING` - StackExchange.Redis-like string, e.g. `localhost:6379,abortConnect=false`
- `REDIS_URL` - Redis URL, e.g. `redis://localhost:6379/0`

The bridge is intentionally read-only and binds to loopback only.
