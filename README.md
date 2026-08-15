# Tablo (tablo.gold)

A board comparing 18-karat gold prices across Iranian online platforms. A collector polls 14 platforms for prices every 30 seconds, stores them in Redis and Postgres, and a web app renders that same data on a live board and per-platform/per-asset pages. No price computation happens in the web layer — web only reads and displays. An outage of any data source is "staleness," not an error: pages still return 200.

## Architecture at a glance

```mermaid
flowchart RL
    subgraph platforms["14 gold-trading platforms"]
        P[wallgold, talasea, milli, …]
    end
    subgraph collector["collector (Python/asyncio)"]
        direction TB
        C1["platform_loop 30s / reference_loop 120s"]
        C2["retention_loop 3600s / content_loop 900s"]
        C3["settings_sync_loop 20s"]
    end
    Redis[(Redis — current price)]
    PG[(Postgres — history, blog, settings)]
    subgraph web["web (TanStack Start / Nitro node-server)"]
        W1["data layer src/lib/server"]
        W2["/api/prices, SSR pages, admin panel"]
    end
    Browser[User's browser]

    P -- HTTP/WS --> collector
    collector -- save_* --> Redis
    collector -- save_* --> PG
    Redis -- get_* --> W1
    PG -- SQL --> W1
    W1 --> W2 --> Browser
```

## Prerequisites

| Tool | Version |
| --- | --- |
| Python | ≥ 3.12 |
| Node.js | 22 |
| Docker + Docker Compose | For local Postgres and Redis |

## Local setup, step by step

**1) Infrastructure services (Postgres + Redis):**

```sh
docker compose -f docker-compose.dev.yml up -d
```

The `collector/migrations/*.sql` migrations run automatically on Postgres's first boot. The default user/password/database are all `mazane` (the repo's old name, deliberately left as-is).

**2) Collector:**

```sh
cd collector
python3 -m venv .venv-local   # collector/.venv is stale, don't use it
source .venv-local/bin/activate
pip install -e ".[dev]"
tablo-collector
```

It starts up fine with no extra environment variables: the code's defaults (`redis://127.0.0.1:6379/0` and `postgresql://mazane:mazane@127.0.0.1:5432/mazane`) line up exactly with `docker-compose.dev.yml`.

**3) Web:**

```sh
cd web
npm install
npm run dev
```

To run the built output: `npm run build && npm start` (which runs `node .output/server/index.mjs`).

## Tests and typecheck

| Layer | Command | Baseline status |
| --- | --- | --- |
| collector | `cd collector && pytest` then `mypy src tests` | 187 passing tests, clean mypy |
| web | `cd web && npm test` (`vitest run`) | 535 passing tests across 31 suites |
| web | `cd web && npm run typecheck` (`tsc --noEmit`) | — |

CI (`.github/workflows/ci.yml`) runs these same two paths on every push/PR (the `collector` and `web` jobs), plus a third job, `images`, that only runs on push to `main`: it builds the Docker images and runs a smoke test (`GET /` must return 200, with no live Redis/Postgres).

## Folder structure

```
collector/
  src/tablo_collector/
    adapters/       14 platform adapters (one file each)
    content/        blog content queue/generator/publisher
    references/     reference price source (talair)
    store/          Redis / Postgres / in-memory (Store protocol)
    main.py         seven main-loop coroutines
    platforms.py    registry of 14 platforms
    models.py       Pydantic models (frozen)
  migrations/       12 SQL files (001 through 017, numbering has gaps)
  tests/            27 test files + fixtures

web/
  src/
    routes/         TanStack Router file-based routes (public + /admin + /api)
    lib/            domain logic; lib/server/ is only imported server-side
    components/     tablo/ (main page), content/ (platform/blog pages), ui/ (shadcn)
  tests/            31 suites

ops/                RUNBOOK, healthcheck, Caddy config, Googlebot verification script
.github/workflows/  CI
compose.prod.yml, Dockerfile.web, Dockerfile.collector, deploy.sh   production deployment
```

## Further documentation

| Document | Topic |
| --- | --- |
| [docs/01-overview.md](docs/01-overview.md) | Product and architecture overview |
| [docs/02-design-components.md](docs/02-design-components.md) | Design components and the web token system |
| [docs/03-tech-debt.md](docs/03-tech-debt.md) | Evidence-based, prioritized tech debt |
| [docs/04-domain.md](docs/04-domain.md) | Domain model (platform, asset, fee, …) |
| [ops/RUNBOOK.md](ops/RUNBOOK.md) | Production deployment, DNS/CDN, rollback |
| [CLAUDE.md](CLAUDE.md) | Guide to working on this repo with Claude Code |
