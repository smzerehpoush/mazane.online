# Tablo Deployment Runbook — ticket 11

> Supervised execution. Every step marked 👤 is done "only with the business
> owner present" (SSH access, the ArvanCloud panel, Search Console, or an
> irreversible decision). The server `37.32.27.201` is shared with Padelyar's
> production project (11 containers + edge Caddy on 80/443) — architecture
> doc section 13, decision 5. The golden rule of this whole document:
> **Padelyar must not shake for even one second.**
>
> **Product domain: `tablo.gold`** (replacing mazane.online). The Caddy
> block, ArvanCloud, and Search Console must all be on this same domain.
> Cutting the live domain over on the server is 👤 — the repository only
> keeps the snippet and `SITE_URL` up to date; change Padelyar's Caddyfile
> by hand (`ops/caddy-snippet.Caddyfile`).
>
> **DNS/CDN decision (owner, 2026-08-09):** the domain is managed with
> **ArvanCloud's nameservers** (full NS delegation) — **not** a CNAME
> connection from the domain to ArvanCloud's CDN hostname. The CDN edge is
> the same cloud/proxy toggle on the DNS records inside the ArvanCloud panel.
> Details: section 6.

Files in this repository that are relevant:

| File | Role |
|---|---|
| `Dockerfile.collector` / `Dockerfile.web` | Build the images (outside the server) |
| `compose.prod.yml` | Run the four services on the server |
| `.env.example` | Configuration sample — copied to `.env` on the server |
| `ops/caddy-snippet.Caddyfile` | Site block for Padelyar's existing Caddyfile |
| `ops/verify-googlebot.py` | Offline reverse-DNS verification of Googlebot visits |
| `ops/collector-healthcheck.py` | Copied inside the collector image |

---

## 0-b. Cutting the domain over to tablo.gold 👤

Owner-reported status (2026-08-09): the domain is purchased and **NS is
set to ArvanCloud**. CDN model = full DNS on ArvanCloud + cloud/proxy on the
A record — **no CNAME to the CDN**.

If the server's Padelyar Caddyfile still has the old `mazane.online` block:

1. Wait for the nameservers to propagate (`dig NS tablo.gold +short` should return ArvanCloud's NS).
2. In the ArvanCloud DNS panel (not the registrar): an `A` record for `@` → `37.32.27.201` with **cloud/proxy on**; optionally `www` as an A record or a redirect inside ArvanCloud — **do not create a CNAME to the CDN hostname**.
4. In the edge Caddyfile: the current block from `ops/caddy-snippet.Caddyfile` (`tablo.gold { … }`); `caddy reload`.
5. The post cover image doesn't need a separate variable: the public address is built from `TABLO_ARVAN_S3_ENDPOINT` and
   `TABLO_ARVAN_S3_BUCKET` (`<endpoint>/<bucket>/<key>`). Only the bucket
   needs to be publicly readable — the upload itself sets `ACL: public-read`.
6. Check `curl -sI https://tablo.gold/` and the local Host header against Caddy.
7. Search Console: a `tablo.gold` domain property + a fresh sitemap.
8. If `mazane.online` still has DNS: a 301 to `tablo.gold` so old SEO doesn't burn away.

---

## 0-c. 👤 Renaming to "Tablo" — mandatory steps on the server

The 2026-08-10 rename changed several infrastructure identifiers. **Before
the first deployment after this change** do the following, or the service
won't come up:

1. **Edge network** — the name went from `mazane-edge` to `tablo-edge`:
   ```
   docker network create tablo-edge
   docker network connect tablo-edge <Padelyar Caddy container name>
   ```
2. **Edge Caddy** — change `reverse_proxy mazane-web:3000` to `tablo-web:3000`
   (`ops/caddy-snippet.Caddyfile` is up to date) and reload Caddy.
   Without this, the site returns 502.
3. **Deployment path** — went from `/opt/mazane` to `/opt/tablo`. Move the
   directory so `.env` (which holds real secrets) goes with it:
   ```
   sudo mv /opt/mazane /opt/tablo && sudo mv /opt/mazane-src /opt/tablo-src
   ```
4. **Environment variables** — all `MAZANE_*` were renamed to `TABLO_*`:
   ```
   sudo sed -i 's/^MAZANE_/TABLO_/' /opt/tablo/.env
   ```
   and remove `TABLO_IMAGE_CDN_BASE_URL` entirely — it's no longer read.
5. **Verify the Postgres volume** (the most important step):
   ```
   docker volume ls | grep postgres-data
   ```
   It must be `mazane_mazane-postgres-data` — the exact name pinned in
   `compose.prod.yml`. If you see a different name, **fix the pin in that
   file, don't remove it**; otherwise Docker creates a fresh, empty volume
   and the production database looks like it's been wiped.

**What deliberately did not change:** the volume name, and the
Postgres user/database (`mazane`). These live inside the existing volume,
and changing them needs a data migration, not a rename.

**Short-term consequence:** Redis keys went from `mazane:*` to `tablo:*`.
Until the first collection round (~30 seconds), the table shows "price
unavailable" — the same staleness, not error rule. The admin session
cookie's name changed too, so you'll need to log in again once.

## 0. Status of ticket 11's acceptance criteria

All three acceptance criteria need a live server/ArvanCloud and are
**pending** in this repository-only pass:

- [ ] pending — "tablo.gold serves a live page from behind ArvanCloud and
      the server's existing programs stay healthy" ⟸ steps 3 through 6
- [ ] pending — "with the origin deliberately taken down, the edge returns a
      stale 200 (a logged test)" ⟸ step 7 — **a hard launch prerequisite**
      (section 10.2)
- [ ] pending — "external monitoring is active and Googlebot's log is
      recorded with reverse-DNS verification" ⟸ steps 8 and 9

---

## 1. Prerequisites — before the deployment session

### 1.1 The web layer is no longer Next.js — what changed

The web app has migrated to **TanStack Start + Vite + Nitro**. Operational consequences:

| Before (Next.js) | Now |
|---|---|
| `.next/standalone` output | `.output/` output |
| `node server.js` | `node .output/server/index.mjs` |
| needed `output: "standalone"` in `next.config.ts` | nothing needed — the preset is in `web/vite.config.ts` |
| `.next/static` and `public` were copied separately | `.output` is **self-contained**: no `node_modules`, no source code |

The old configuration prerequisite (a single `output: "standalone"` line)
**no longer applies**. In its place sits a new constraint that is just as
blocking:

> The Nitro preset must be `node-server`. This stack's historical default
> was `cloudflare-module`, where neither `ioredis` nor `pg` works. It's set
> explicitly in `web/vite.config.ts` and has a guard in **three places**:
> one step in `Dockerfile.web`, one step in CI, and this document.

Real sizes and usage (measured, not estimated):

- Web image: **~160MB** for `linux/amd64` (base `node:22-alpine`).
- Web container memory: **~31MB** idle, **~61MB** after 200 SSR requests.
  `compose.prod.yml`'s cap went from 384M to **256M**; the four services'
  combined cap 992MB ← **864MB**.
- `NODE_OPTIONS=--max-old-space-size=192` in `Dockerfile.web`. This number is
  **paired** with the 256M cap: otherwise V8 guesses the heap cap from the
  host's RAM and can grow to nearly 2GB — meaning the OOM-killer goes after
  Padelyar instead of this process. If one changes, the other must too.

### 1.2 👤 Image registry decision

> 🔄 **Owner decision (2026-08-08): the standard method from now on is
> `./deploy.sh`** — building the image **on the server itself**, exactly
> like the pattern of the sibling Padelyar project (`~/w/padelyar/deploy.sh`,
> the same server, the same TanStack Start + Vite stack). Reason for the
> change: Padelyar has been doing exactly this here for years with no
> reported failure. The risk below (limited RAM) is **not rejected, it's
> accepted** — `deploy.sh` checks free RAM before every build and stops if
> it's dangerous, and it builds the two images back-to-back rather than
> simultaneously. If a real OOM ever happens, come back here and fall back
> to the local path below (a section kept, not deleted, for that Tuesday).

Current path: **build on the server with `./deploy.sh`** (repository
root). The code goes over via `rsync` (`web-crawler/` and `.env` are
explicitly excluded from rsync), then `docker build -f Dockerfile.web` and
`-f Dockerfile.collector` back-to-back on the server itself, then
`docker compose up -d web collector`.

Older paths (in case registry-based or laptop-based builds are ever needed again):

| Path | Upside | Risk |
|---|---|---|
| **GHCR:** the `images` job in CI with `push: true` + `docker compose pull` on the server | Reproducible, no manual transfer | Iranian access to `ghcr.io` may be filtered/restricted — test from the server itself before relying on it: `curl -sI https://ghcr.io/v2/`. Never actually set up. |
| **Laptop build + manual transfer:** `docker save tablo-web:v1 \| gzip \| ssh ubuntu@37.32.27.201 'gunzip \| sudo docker load'` | Doesn't depend on any external service; zero processing load on the server | Manual and slow (~2.5 minutes per image on this bandwidth); the server only has ~7GB free disk — after every load, old images must be pruned (`sudo docker image prune -f`). Ticket 34's deploy (the admin panel) was done via this exact path, before the decision above. |

If GHCR is chosen: in `.github/workflows/ci.yml` the `images` job gets
these added: `docker/login-action` with `GITHUB_TOKEN`, `push: true`, and
the tags `ghcr.io/smzerehpoush/mazane-{web,collector}:{latest,sha}`; and,
once, on the server, `docker login ghcr.io` with a read-only PAT (scope:
`read:packages`).

### 1.3 Building the images (CI or laptop)

On the laptop (Apple Silicon Mac), always with the server's platform:

```bash
docker build --platform linux/amd64 -f Dockerfile.collector -t tablo-collector:v1 .
docker build --platform linux/amd64 -f Dockerfile.web       -t tablo-web:v1 .
```

Verify the web image **before** shipping it to the server — deliberately
without Redis and without Postgres, because the expectation is 200, not 500
(hard rule 5: a source outage is staleness, not error):

```bash
docker run --rm -d --name tablo-web-smoke \
  --memory 256m --cpus 0.5 -p 127.0.0.1:3399:3000 tablo-web:v1
sleep 5
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3399/            # 200
curl -sI http://127.0.0.1:3399/fonts/vazirmatn-variable-33.0.3.woff2 \
  | grep -iE 'HTTP|cache-control'      # 200 + immutable — self-hosted font
docker stats --no-stream tablo-web-smoke                                  # ~31MB
docker rm -f tablo-web-smoke
```

This same smoke test also runs in CI (the `images` job).

### 1.4 👤 Preparing `.env`

Based on `.env.example`. Notes:

- `POSTGRES_PASSWORD` and `TABLO_REVALIDATE_TOKEN` with `openssl rand -hex 32`.
- `TABLO_REVALIDATE_TOKEN` is shared between the collector and web (compose
  itself gives it to both). The `/api/revalidate-blog` route **always**
  returns 401 without a configured token (fail closed) — so a mistake there
  shows up in the collector's log. With the migration off Next.js there's no
  more page-level cache at the origin either: a new post is seen at most 60
  seconds later in the worst case (the edge's `s-maxage` window).
- `TABLO_DAILY_PUBLISH_CAP` (default 2 — decision 16) no longer caps anything:
  publishing is human-only through the admin panel. It is the assumed daily
  editorial pace the collector uses to express the draft queue's depth in days.
- `TABLO_WEB_PORT` (default 3300) must not collide with Padelyar's ports —
  check on the server: `ss -ltn | grep 3300`.
- If the "no registry" path was chosen, set `TABLO_IMAGE_*` to the loaded
  tags (e.g. `tablo-web:v1`).
- 👤 **Admin panel password (ticket 20).** The panel under `/admin` has only
  a single password (no user/role table). The password itself is **never**
  written to the repository or `.env` — only its hash. On the laptop or the
  server (wherever Node 22 is):
  ```bash
  cd web && npm run admin:hash-password -- '<chosen password>'
  ```
  Copy the output (hex format `salt:hash`) into `TABLO_ADMIN_PASSWORD_HASH`.
  For `TABLO_ADMIN_SESSION_SECRET`, same as the rest: `openssl rand -hex 32`.
  Don't write the raw password anywhere but 👤's own memory — the script
  only prints the hash to stdout and never logs the password anywhere.
- 👤 **Post cover image storage (ticket 24).** Before this step, in the
  ArvanCloud panel:
  1. Create an S3-compatible cloud storage bucket (any name, e.g.
     `mazane-posts`) and create an access key (Access Key/Secret Key)
     dedicated to that same bucket — don't create a key shared with other
     services.
  2. Put `TABLO_ARVAN_S3_ENDPOINT`, `TABLO_ARVAN_S3_REGION`,
     `TABLO_ARVAN_S3_BUCKET`, `TABLO_ARVAN_S3_ACCESS_KEY`, and
     `TABLO_ARVAN_S3_SECRET_KEY` from that same panel into `.env` — these
     five values are nowhere in the repository and must not be.
  3. **No CDN subdomain is needed** (owner decision 2026-08-07, confirmed
     2026-08-10): the public image URL is built from that same endpoint and
     bucket above — `<endpoint>/<bucket>/<key>`. Only the bucket needs to be
     publicly readable; the upload itself sets `ACL: public-read`.
     ⚠️ This is a deliberate deviation from ticket 24's design principle
     ("no foreign domain sits on the critical render path"): the ArvanCloud
     domain is visible in the page HTML, and switching providers would break
     the URL of every old image.
  Losing this storage only breaks new image uploads — saving post text and
  rendering existing posts are unaffected (completely separate paths).
- 👤 **IndexNow (ticket 59).** `TABLO_INDEXNOW_KEY` is deliberately left
  **empty** — the ping is then skipped and publishing behaves exactly as
  before. Filling it in requires hosting a key file first; the three steps
  are in section 14. Don't set it before that file is verified.

### 1.5 Files that must be on the server

Only these (the whole repository isn't needed):

```
/opt/tablo/
├── compose.prod.yml
├── .env                        # from 1.4
└── collector/migrations/*.sql  # the same relative structure compose mounts
```

---

## 2. 👤 Step zero on the server — Padelyar status snapshot

Before any change, record a baseline so that "existing programs staying
healthy" can be verified:

```bash
ssh root@37.32.27.201
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | tee /root/pre-mazane-docker-ps.txt
free -m ; df -h /            # free RAM and disk — expected: ~1.2GB RAM, ~8GB disk
curl -sI https://<Padelyar domain>/ | head -5   # Padelyar returns 200 from outside
```

If free RAM is under ~1GB, stop and investigate — our compose caps total 864MB.

---

## 3. 👤 Deploying the containers

```bash
mkdir -p /opt/tablo
# scp the files from step 1.5, then:
cd /opt/tablo
chmod 600 .env

docker network create tablo-edge        # network shared with the edge Caddy (step 5)

# --- Images: one of the two paths from step 1.2 ---
docker compose -f compose.prod.yml pull            # GHCR path
# or docker load  (no-registry path — pushed from the laptop via ssh)
```

> ⚠️ `postgres:16` and `redis:7` come from Docker Hub, and the Hub
> restricts access from Iranian IPs. Padelyar already pulls images right
> now, so the server's `/etc/docker/daemon.json` probably has a mirror —
> check that first. If it doesn't: either use ArvanCloud's mirror
> (`docker pull docker.arvancloud.ir/postgres:16`, then `docker tag` to
> `postgres:16`) or transfer these two images the same way as Tablo's
> images, with `docker save | ssh docker load`. Don't touch `daemon.json`
> without 👤's permission (restarting docker drops every Padelyar container).

```bash

docker compose -f compose.prod.yml up -d postgres redis
docker compose -f compose.prod.yml ps              # both must become healthy
```

### Migrations (001 through 012)

The volume is fresh ⟸ on first boot Postgres runs **every**
`/docker-entrypoint-initdb.d/*.sql` file in lexicographic order (001, 002,
003, 004, 010, 011, 012 — the number gaps are deliberate). Verification:

```bash
docker compose -f compose.prod.yml exec postgres \
  psql -U mazane -d mazane -c '\dt'
# Expected: price/history/references/posts/rollup tables — not an empty list
```

If in the future the volume is already initialized and a new migration is
added, initdb no longer runs it — do it by hand, in numeric order:

```bash
docker compose -f compose.prod.yml exec postgres \
  psql -U mazane -d mazane -f /docker-entrypoint-initdb.d/013_xxx.sql
```

### Bringing up web and the collector

```bash
docker compose -f compose.prod.yml up -d web collector
docker compose -f compose.prod.yml ps    # all healthy (the collector has up to a ~2-minute start_period)

curl -s http://127.0.0.1:3300/ | head -20         # Persian HTML of the homepage
# Note: there's no more build-time prerender — every request is SSR'd and the
# loader reads Redis/Postgres at that exact moment. If the collector hasn't
# had a turn yet, the table is empty/stale but the response is **200**, not
# an error (hard rule 5).
# So "the page came up but has no price" is normal in the first minute;
# "the page returned 500" is not.
curl -s http://127.0.0.1:3300/robots.txt           # includes Disallow: /go/ and Sitemap:
curl -sI http://127.0.0.1:3300/fonts/vazirmatn-variable-33.0.3.woff2 \
  | grep -iE 'HTTP|cache-control'   # 200 + immutable — the font comes from the origin itself
docker compose -f compose.prod.yml logs --tail 50 collector   # a "collection round" with prices
```

---

## 4. 👤 Verifying Padelyar's health (repeat after every remaining step)

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | diff /root/pre-mazane-docker-ps.txt - || true
free -m                                            # free RAM must not have gone negative
curl -sI https://<Padelyar domain>/ | head -3     # still 200
```

---

## 5. 👤 Connecting to the existing edge Caddy

> The only step that touches Padelyar's configuration. Back up the
> existing Caddyfile before it.

```bash
CADDY=<Padelyar Caddy container name>          # find it from docker ps
docker network connect tablo-edge $CADDY

# Inside the Caddy container, the name tablo-web must resolve and respond:
docker exec $CADDY wget -qO- http://tablo-web:3000/ | head -3
```

Then append the content of `ops/caddy-snippet.Caddyfile` (without the
header comments, from the `tablo.gold {` block onward) to the **end** of the
existing Caddyfile. Notes:

- Find the Caddyfile path from Padelyar's compose (usually a bind mount).
- For persistent logs, the Caddy container's `/var/log/caddy` needs a
  volume/bind; if it doesn't have one, add it to Padelyar's compose (one
  volume line — with 👤's permission).
- **TLS behind ArvanCloud:** Caddy obtains an ACME certificate for
  `tablo.gold`. The HTTP-01 path must pass through the ArvanCloud edge
  (`/.well-known/acme-challenge/*` must not be cached or blocked). If
  issuance gets stuck: temporarily set the A record to "DNS only" (no proxy)
  in the ArvanCloud panel, and turn the proxy back on once issuance is done.

```bash
docker exec $CADDY caddy validate --config /etc/caddy/Caddyfile   # validate first
docker exec $CADDY caddy reload   --config /etc/caddy/Caddyfile   # then reload (no downtime)
docker exec $CADDY wget -qO- --header 'Host: tablo.gold' http://127.0.0.1/ | head -3
```

A failure in reload = restore the backup Caddyfile + reload again (rollback, step 11).

---

## 6. 👤 ArvanCloud — DNS and caching (full NS, no CNAME to the CDN)

**The final model:** the registrar only has ArvanCloud's nameservers. All
records and the CDN edge are built inside ArvanCloud's DNS/CDN panel. The
"CNAME the domain to ArvanCloud's CDN hostname" path **is not used** for
this product.

In the ArvanCloud panel (the business owner's existing account):

0. **Nameservers:** at the registrar, `tablo.gold` must point at
   ArvanCloud's NS (owner: done 2026-08-09). Until propagation, the records
   inside the panel aren't visible from the internet — check with
   `dig NS tablo.gold` and `dig A tablo.gold`.
1. **DNS inside ArvanCloud:** an `A` record for `@` (and `www` if desired) to
   `37.32.27.201` with **cloud/proxy on**. Short TTL (2 minutes) until it
   settles. The origin is the server's IP itself; ArvanCloud's cloud picks up
   traffic at the edge.
2. **Edge HTTPS:** ArvanCloud's edge certificate active; the edge⟸origin
   connection over HTTPS (Caddy's valid certificate from step 5) or per the
   panel's options.
3. **Caching:** "follow the origin header" mode — the homepage returns
   `Cache-Control: public, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400`
   (section 6.2; the source of truth is `web/src/lib/seo/cache-headers.ts`).
   A separate manual cache rule for HTML isn't needed, and the origin header
   **must not** be overridden — especially `stale-if-error`, which is
   exactly step 7's hard prerequisite. Static assets (hashed `/assets/**` and
   versioned `/fonts/**`) already return `max-age=31536000, immutable`
   themselves; pass those through untouched too.
4. Verify from outside: `curl -sI https://tablo.gold/` ⟸ 200 + the same
   `Cache-Control` + ArvanCloud's cache headers (`X-Cache` or `Ar-Cache`; HIT
   on the second request).

---

## 7. 👤 The "stale 200 during an origin outage" test — hard launch prerequisite (section 10.2)

> **Launch is forbidden until this test passes.** This is the hosting
> architecture's single point of failure: if ArvanCloud returns a 5xx to
> Googlebot during an origin outage, the site gets deindexed within a few
> days. (Business owner's pending action 3, section 13.1.)

Procedure — preferably from a vantage point outside Iran (a foreign VPS/VPN):

```bash
# 1) Warm the edge cache and record the baseline (from outside):
curl -sI https://tablo.gold/ ; sleep 5 ; curl -sI https://tablo.gold/
# Expected: 200; the second request's ArvanCloud cache header is HIT

# 2) Deliberately take down the origin (on the server):
docker compose -f /opt/tablo/compose.prod.yml stop web

# 3) From outside, at minutes 1, 2, and 5 (important: also after s-maxage=60 expires):
date -u ; curl -sI https://tablo.gold/
# Pass: "200" all three times, with stale HTML. Fail: any 5xx/52x.

# 4) Record evidence (acceptance criterion "a logged test"): keep the full
#    output of curl -i and date -u for all three rounds in one file/screenshot.

# 5) Bring the origin back:
docker compose -f /opt/tablo/compose.prod.yml start web
curl -sI https://tablo.gold/        # fresh 200 again
```

If it fails: enable the "serve cached content on origin error" option in
ArvanCloud's cache settings (and if it doesn't exist, raise it with
ArvanCloud support), then redo the test. Whatever the result, record it in
this document under this same section, with a date.

---

## 8. 👤 External monitoring (section 10.2, requirement 2)

Monitoring must be **from outside Iran** — the only question that matters
is whether Googlebot can reach it. Any free service with foreign nodes is
enough (UptimeRobot, Better Stack, StatusCake — the choice is 👤's since the
account is tied to their email):

- Two HTTPS checks every 5 minutes: `https://tablo.gold/` and
  `https://tablo.gold/robots.txt`; passing condition: status 200.
- Alert to the business owner's email.
- Note: activate it after step 7's test so it doesn't false-alarm; or keep
  it paused during the test.

---

## 9. Googlebot log + reverse DNS verification (section 10 and decision 14)

The JSON log was enabled in step 5 (`/var/log/caddy/mazane-access.log`
inside the Caddy container, including the User-Agent and the real IP behind
ArvanCloud). Authenticity verification, offline and periodic:

```bash
# On the server (python3 is present on Ubuntu 24.04) — scp the script over once:
docker exec <Caddy container> cat /var/log/caddy/mazane-access.log > /tmp/mazane-access.log
python3 /opt/tablo/verify-googlebot.py /tmp/mazane-access.log
```

Output: genuine Google hits (PTR to `googlebot.com`/`google.com` +
verified forward), fake claimants, paths, and status codes — with an
explicit warning if genuine Googlebot was seen getting a 5xx. **Run it
weekly** (manually or a simple cron on the server), and until Search Console
access is verified (decision 14), this is the only criterion for "Google is
crawling us."

---

## 10. 👤 Search Console — DNS TXT (section 10.2, requirement 3)

1. In Search Console, a **Domain**-type property for `tablo.gold`.
2. Add Google's suggested `TXT` record in **ArvanCloud's DNS panel** (it
   doesn't depend on hosting and doesn't break when hosting changes — the
   reason this method was chosen).
3. The sitemap doesn't need manual registration: `robots.txt` has a
   `Sitemap:` line (`web/app/robots.ts`); manual registration in Search
   Console is also fine.
4. Reminder: the business owner's own access to Search Console still isn't
   confirmed (pending action 1, section 13.1) — step 9 works independently
   of that outcome.

---

## 11. Rollback

Reverse order, with no effect on Padelyar:

```bash
# 1) Cut edge traffic: remove/comment out the tablo.gold block from Padelyar's Caddyfile
docker exec $CADDY caddy reload --config /etc/caddy/Caddyfile

# 2) Shut down Tablo (data stays in the volume):
docker compose -f /opt/tablo/compose.prod.yml down
# Full cleanup (only if you deliberately want history gone too): down -v

# 3) Optional: docker network disconnect tablo-edge $CADDY
# 4) 👤 ArvanCloud: pause the proxy or remove the record — only if needed
```

Every step is reversible; `docker compose up -d` brings everything back
again (the images stay on the server).

---

## 12. Deployment session wrap-up checklist

- [ ] 1.1 CI is green and `.output/nitro.json`'s preset is `node-server`
      (the web image smoke test passed in the `images` job)
- [ ] 1.2 👤 Registry decision + push wiring (if GHCR)
- [ ] 2 👤 Padelyar status snapshot recorded
- [ ] 3 👤 Four services healthy; migrations applied; `127.0.0.1:3300` returns 200
- [ ] 4 👤 Padelyar healthy (after every step)
- [ ] 5 👤 Caddy reloaded; `tablo.gold` is served from the edge Caddy
- [ ] 6 👤 ArvanCloud: NS set; A record with cloud on (no CNAME to the CDN) + cache follows origin header
- [ ] 7 👤 **Stale-200 test passed and its evidence recorded** (launch prerequisite)
- [ ] 8 👤 External monitoring active on `/` and `/robots.txt`
- [ ] 9 First run of `verify-googlebot.py` done and a weekly schedule set up
- [ ] 10 👤 Search Console TXT confirmed
- [ ] 14 👤 IndexNow key generated, `<key>.txt` served by the edge, and
      `TABLO_INDEXNOW_KEY` set — **still open**; until then the ping is
      skipped and publishing is unaffected

---

## 13. Platform listing permissions

A platform is publicly listed only while its `data_policy` in
`collector/src/tablo_collector/platforms.py` is `ALLOWED`. Whenever a policy is
raised to `ALLOWED` on the strength of a written permission, the permission
document itself must be findable — record it in the table below before the
deploy that publishes the platform.

| Platform | Policy | Permission | Where the document is filed |
|---|---|---|---|
| goldika | `ALLOWED` | Written permission granted by Goldika; confirmed by 👤 | 👤 **TODO** — fill in the location of the permission document (shared drive path / email thread / ticket link) |

Every other listed platform is published on the basis of its own publicly
available data, with no separate permission document.

---

## 14. 👤 IndexNow — NOT SET UP YET (ticket 59)

IndexNow lets us tell Bing/Yandex (and any other participating engine) that a
URL just changed, instead of waiting to be crawled. Web already does the
submitting: every successful `POST /api/revalidate-blog` — the call the admin
panel makes right after a post is published — also posts the listing and the
post URL to `https://api.indexnow.org/indexnow`
(`web/src/lib/server/indexnow.ts`).

It is **inert until 👤 does the three steps below**. With no key the route
reports `"indexnow": "skipped"` in its JSON response and makes no outbound
request at all; publishing is unaffected either way, and a failed submission
is logged and reported as `"indexnow": "failed"` — never a 5xx (hard rule 5).

### The three steps

1. **Generate a key.** Any self-chosen string of 8–128 characters from
   `[A-Za-z0-9-]`:
   ```bash
   openssl rand -hex 32
   ```
   It is not a secret — it is published on our own site in step 2 — but it
   must be ours and it must stay the same.

2. **Host the key file.** IndexNow verifies ownership by fetching
   `https://tablo.gold/<key>.txt`, which must return that exact key as plain
   text (no trailing markup; a trailing newline is fine). The cheapest place
   is the edge Caddy, next to the `tablo.gold` block in
   `/opt/padelyar/deploy/Caddyfile` (see `ops/caddy-snippet.Caddyfile`) —
   inside **both** the `http://` and the `https://` site blocks, above
   `reverse_proxy`:
   ```caddyfile
   handle /<key>.txt {
       respond "<key>" 200
   }
   ```
   then `docker exec $CADDY caddy reload --config /etc/caddy/Caddyfile` and
   check from outside:
   ```bash
   curl -s https://tablo.gold/<key>.txt   # must print exactly <key>
   ```
   ⚠️ If ArvanCloud is caching, purge that one path after any change — a
   cached 404 on the key file makes every submission fail.

3. **Set the variable.** `TABLO_INDEXNOW_KEY=<key>` in the server's .env,
   then `docker compose -f /opt/tablo/compose.prod.yml up -d web`. The
   variable is optional in `compose.prod.yml` (`${TABLO_INDEXNOW_KEY:-}`), so
   a missing value never blocks a deploy.

### Verifying

```bash
# From the server, with the real token — the same call the panel makes:
curl -s -X POST http://127.0.0.1:3300/api/revalidate-blog \
  -H "authorization: Bearer $TABLO_REVALIDATE_TOKEN" \
  -H "content-type: application/json" -d "{}"
```

Expected once all three steps are done: `"indexnow":"submitted"`. Before
them: `"indexnow":"skipped"` — which is the correct, healthy state until
👤 finishes the setup. `"failed"` means the endpoint refused or was
unreachable; the most common cause is the key file of step 2 not being
readable at the URL above. The second candidate is egress — the web container
needs outbound internet (the `internal` network is a plain bridge, not
`internal: true`, so it has it by default):

```bash
docker exec tablo-web node -e "fetch('https://api.indexnow.org/').then(r=>console.log(r.status)).catch(e=>console.log('no egress:',e.message))"
```

⚠️ Do **not** set `TABLO_INDEXNOW_KEY` before step 2 is verified: a key
without its file means every publish burns a rejected submission and logs an
error for no gain.
