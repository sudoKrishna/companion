# ai-server

Everything the companion can think or do, in TypeScript. The Tauri app spawns this
automatically on startup; run it by hand only when working on it alone.

```bash
bun install
bun run dev      # bun --hot src/index.ts
```

Listens on `127.0.0.1:4000` (loopback only). Keys come from `.env`:
`DEEPSEEK_API_KEY`, `ASSEMBLYAI_API_KEY`, `ELEVENLABS_API_KEY`, `DATABASE_URL`.

Storage is Postgres via Prisma. Locally that's a Docker container:

```bash
bun run db:up        # starts Postgres (docker-compose.yml)
bun run db:migrate   # applies prisma/migrations, regenerates the client
bun run db:studio    # browse the data
```

## Layout

| File | Role |
| --- | --- |
| `src/index.ts` | express app, middleware, router mounting |
| `src/routes/chat.ts` | `/chat`, `/suggest`, `/tools` |
| `src/routes/voice.ts` | `/transcribe` (AssemblyAI), `/speak` (ElevenLabs) |
| `src/routes/tools.ts` | `/tools/execute` — token-gated |
| `src/routes/memory.ts` | `/memory/facts`, `/conversations`, `/audit/tool` |
| `src/routes/preferences.ts` | `/preferences` |
| `src/deepseek.ts` | system prompt, DeepSeek call |
| `src/tools.ts` | tool registry: schema, risk, scope |
| `src/executor.ts` | runs the tools that are plain TypeScript |
| `src/memory.ts` | facts, messages, tool audit (Postgres via Prisma) |
| `src/prefs.ts` | preferences, stored as one JSON row (Postgres via Prisma) |
| `src/db.ts` | the shared `PrismaClient` |
| `prisma/schema.prisma` | `Fact`, `Message`, `ToolAudit`, `Preference` models |

## How a tool call runs

1. `/chat` sends the registry to DeepSeek as OpenAI-style functions.
2. Any `toolCalls` come back to the app, which shows the permission dialog.
3. On approval the app calls `/tools/execute` (or a native Tauri command for
   `capture_screen` / `active_window`), then posts the result back to `/chat` as a
   `tool` message.

`/tools/execute` requires an `x-companion-token` header matching `COMPANION_TOKEN`,
which Tauri generates per launch and passes in the environment — without it any
local process could run shell commands through this server.
