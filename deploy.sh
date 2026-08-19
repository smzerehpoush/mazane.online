#!/usr/bin/env bash
# ============================================================
# Deploy Tablo Online from the laptop to the server — the Padelyar pattern
# (~/w/padelyar/deploy.sh): the code gets rsynced and the images are built on
# the server itself, not locally.
#
# Owner decision (2026-08-08): this is deliberately against the old runbook
# (sections 1.2/1.3), which rejected building on the server because of
# limited RAM (1 core/2GB, shared with Padelyar). That risk is still real —
# Padelyar has succeeded here, but I have no record of its failures/lack of
# failures. That's why this script checks free RAM before building and stops
# if it's dangerous, and builds the two images back-to-back rather than
# simultaneously (halving the peak RAM usage).
#
#   ./deploy.sh              full deploy (rsync + build + up + health check)
#   ./deploy.sh status       status of Tablo's containers on the server
#   ./deploy.sh logs web|collector
#
# Overridable variables:
#   SERVER=ubuntu@37.32.27.201  SSH_KEY=~/.ssh/padelyar_deploy  ./deploy.sh
# ============================================================
set -euo pipefail

SERVER="${SERVER:-ubuntu@37.32.27.201}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/padelyar_deploy}"
REMOTE_SRC_DIR="/opt/tablo-src"
REMOTE_RUN_DIR="/opt/tablo"
SITE_URL="https://tablo.gold/"
MIN_AVAILABLE_MB=400
SSH_OPTS=(-i "$SSH_KEY" -o ConnectTimeout=20)

cd "$(dirname "$0")"

case "${1:-deploy}" in
  status)
    ssh "${SSH_OPTS[@]}" "$SERVER" 'sudo docker ps --filter name=tablo --format "{{.Names}}: {{.Status}}"'
    exit 0 ;;
  logs)
    svc="${2:-web}"
    ssh "${SSH_OPTS[@]}" "$SERVER" "sudo docker logs -f --tail 100 tablo-${svc}"
    exit 0 ;;
  deploy) ;;
  *) echo "unknown command: $1 (options: deploy | status | logs [web|collector])"; exit 1 ;;
esac

START_TS=$(date +%s)

echo "==> [1/6] انتقال کد به سرور (${REMOTE_SRC_DIR})…"
# ⚠️ web-crawler/ is the client's proprietary code — it must never go to this server.
# The local .env holds real secrets — it must never end up anywhere but /opt/tablo/.env.
rsync -az --delete \
  --exclude node_modules --exclude .output --exclude .git \
  --exclude .claude \
  --exclude .venv --exclude __pycache__ --exclude web-crawler \
  --exclude '.env' --exclude '.env.*' --exclude '.DS_Store' \
  --exclude collector-dev.log \
  -e "ssh ${SSH_OPTS[*]}" ./ "$SERVER:$REMOTE_SRC_DIR/"

echo "==> [2/6] بررسی رم آزاد سرور قبل از ساخت…"
AVAILABLE_MB=$(ssh "${SSH_OPTS[@]}" "$SERVER" "free -m | awk '/^Mem:/{print \$7}'")
echo "    رم available: ${AVAILABLE_MB}MB (حداقل لازم: ${MIN_AVAILABLE_MB}MB)"
if [ "$AVAILABLE_MB" -lt "$MIN_AVAILABLE_MB" ]; then
  echo "❌ رم آزاد کافی نیست — ساخت روی سرور می‌تواند OOM-killer را روی کانتینرهای"
  echo "   پادل‌یار هم فعال کند. متوقف شدم؛ دستی بررسی کن (free -m, docker stats)."
  exit 1
fi

echo "==> [3/6] ساخت ایمیج‌ها روی سرور — پشت‌سرهم، نه هم‌زمان…"
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "set -o pipefail; cd $REMOTE_SRC_DIR && \
   sudo docker build -f Dockerfile.web       -t tablo-web:deploy       . 2>&1 | tail -5 && \
   sudo docker build -f Dockerfile.collector -t tablo-collector:deploy . 2>&1 | tail -5"

echo "==> [4/6] مهاجرت‌های تازه — فقط هشدار، اجرا دستی است…"
ssh "${SSH_OPTS[@]}" "$SERVER" "
  comm -23 \
    <(ls $REMOTE_SRC_DIR/collector/migrations/*.sql | xargs -n1 basename | sort) \
    <(ls $REMOTE_RUN_DIR/collector/migrations/*.sql 2>/dev/null | xargs -n1 basename | sort) \
    > /tmp/tablo-new-migrations.txt || true
  if [ -s /tmp/tablo-new-migrations.txt ]; then
    echo '    ⚠️ مهاجرت تازه‌ی اجرا‌نشده:'
    cat /tmp/tablo-new-migrations.txt
    echo '    رانبوک بخش ۳: docker compose exec postgres psql ... -f /docker-entrypoint-initdb.d/<فایل>'
    echo '    ⚠️ همین حالا اجرا کن: گام ۵ فایل را در دایرکتوری اجرا کپی می‌کند و'
    echo '       این هشدار در دیپلوی بعدی دیگر تکرار نمی‌شود (کپی ≠ اجرا).'
  else
    echo '    چیزی تازه نیست.'
  fi
"

echo "==> [5/6] همگام‌سازی دایرکتوری اجرا + بالا آوردن نسخه‌ی تازه…"
# ⚠️ The build happens from $REMOTE_SRC_DIR but compose runs from $REMOTE_RUN_DIR.
# Before this, the two were never kept in sync: the run directory had its own
# compose.prod.yml and migrations that got staler with every deploy. In the
# rename deploy (2026-08-10) this is exactly what caused compose to still
# read MAZANE_* and fail with "required variable MAZANE_REVALIDATE_TOKEN is
# missing".
#
# .env is deliberately not copied: the real secret only lives on the server,
# and rsync explicitly excludes it too.
ssh "${SSH_OPTS[@]}" "$SERVER" "
  sudo cp $REMOTE_SRC_DIR/compose.prod.yml $REMOTE_RUN_DIR/compose.prod.yml
  sudo mkdir -p $REMOTE_RUN_DIR/collector/migrations
  sudo cp $REMOTE_SRC_DIR/collector/migrations/*.sql $REMOTE_RUN_DIR/collector/migrations/
  sudo sed -i 's|^TABLO_IMAGE_WEB=.*|TABLO_IMAGE_WEB=tablo-web:deploy|' $REMOTE_RUN_DIR/.env
  sudo sed -i 's|^TABLO_IMAGE_COLLECTOR=.*|TABLO_IMAGE_COLLECTOR=tablo-collector:deploy|' $REMOTE_RUN_DIR/.env
  cd $REMOTE_RUN_DIR && sudo docker compose -f compose.prod.yml up -d web collector
"

echo "==> [6/6] پاک‌سازی ایمیج‌های بلااستفاده + تست سلامت…"
ssh "${SSH_OPTS[@]}" "$SERVER" 'sudo docker image prune -f >/dev/null; echo ok'
sleep 5
HTTP_CODE=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" "$SITE_URL")
ELAPSED=$(( $(date +%s) - START_TS ))
if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "✅ دیپلوی موفق در ${ELAPSED} ثانیه — $SITE_URL (HTTP $HTTP_CODE)"
else
  echo ""
  echo "⚠️ سایت پاسخ $HTTP_CODE داد — لاگ را ببین: ./deploy.sh logs web"
  exit 1
fi
