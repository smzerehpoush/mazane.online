#!/usr/bin/env bash
# ============================================================
# دیپلوی مظنه آنلاین از لپ‌تاپ به سرور — الگوی پادل‌یار (~/w/padelyar/deploy.sh):
# کد rsync می‌شود و ایمیج‌ها روی خودِ سرور ساخته می‌شوند، نه لوکال.
#
# تصمیم مالک (۲۰۲۶-۰۸-۰۸): این عمداً برخلاف رانبوک قدیمی (بخش ۱.۲/۱.۳) است
# که ساخت روی سرور را به‌خاطر رم محدود (۱ هسته/۲GB، مشترک با پادل‌یار) رد
# می‌کرد. آن ریسک هنوز واقعی است — پادل‌یار همین‌جا موفق بوده، ولی هیچ سابقه‌ای
# از خرابی/نبودِ خرابی‌اش در دسترس من نیست. به همین دلیل این اسکریپت پیش از
# ساخت رم آزاد را چک می‌کند و اگر خطرناک بود متوقف می‌شود، و دو ایمیج را
# پشت‌سرهم می‌سازد نه هم‌زمان (اوج مصرف رم نصف می‌شود).
#
#   ./deploy.sh              دیپلوی کامل (rsync + build + up + سلامت)
#   ./deploy.sh status       وضعیت کانتینرهای مظنه روی سرور
#   ./deploy.sh logs web|collector
#
# متغیرهای قابل بازنویسی:
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
  *) echo "دستور ناشناخته: $1 (گزینه‌ها: deploy | status | logs [web|collector])"; exit 1 ;;
esac

START_TS=$(date +%s)

echo "==> [1/6] انتقال کد به سرور (${REMOTE_SRC_DIR})…"
# ⚠️ web-crawler/ کد اختصاصی کارفرماست — هرگز نباید به این سرور برود.
# .env محلی راز واقعی دارد — هرگز نباید جای دیگری جز /opt/tablo/.env بنشیند.
rsync -az --delete \
  --exclude node_modules --exclude .output --exclude .git \
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
  else
    echo '    چیزی تازه نیست.'
  fi
"

echo "==> [5/6] بالا آوردن نسخه‌ی تازه…"
ssh "${SSH_OPTS[@]}" "$SERVER" "
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
