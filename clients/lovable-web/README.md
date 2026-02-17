# Synthesis Lovable Web Client

React + TypeScript web client for browsing and editing Twins through MCP.

## Features

- Twin list browser (`twin.list`)
- Twin detail loader (`twin.getState`)
- Twin metadata editing (`twin.update`)
- Event appender (`twin.appendEvent`)
- Twin creation (`twin.create`)

## Run

From repo root:

```bash
pnpm install
pnpm dev:web
```

The Vite dev server proxies `/mcp` and `/healthz` to `http://localhost:8080`.

Optional env var:

- `VITE_MCP_BASE_URL` (defaults to current origin)
