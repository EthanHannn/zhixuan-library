#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/zhixuan-library"
STAGING_DIR="/tmp"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "服务器缺少 Docker Compose。" >&2
  exit 1
fi

required=(
  "zhixuan-library-image.tar"
  "zhixuan-library.db"
  "zhixuan-covers.tar.gz"
  "zhixuan-novels-score-7.5-plus.tar.gz"
  "zhixuan-artifacts.sha256"
  "compose.production.yml"
  ".env.production"
  "nginx-library.conf"
)

for name in "${required[@]}"; do
  if [[ ! -f "${STAGING_DIR}/${name}" ]]; then
    echo "缺少部署文件：${STAGING_DIR}/${name}" >&2
    exit 1
  fi
done

cd "${STAGING_DIR}"
sha256sum --check zhixuan-artifacts.sha256

install -d -m 0755 "${APP_DIR}" "${APP_DIR}/data" "${APP_DIR}/novels" "${APP_DIR}/covers"
install -m 0644 "${STAGING_DIR}/compose.production.yml" "${APP_DIR}/compose.production.yml"
install -m 0600 "${STAGING_DIR}/.env.production" "${APP_DIR}/.env.production"

if [[ ! -f "${APP_DIR}/data/library.db" ]]; then
  install -m 0660 "${STAGING_DIR}/zhixuan-library.db" "${APP_DIR}/data/library.db"
fi

if [[ ! -f "${APP_DIR}/.novels-score-7.5-imported" ]]; then
  tar -xzf "${STAGING_DIR}/zhixuan-novels-score-7.5-plus.tar.gz" -C "${APP_DIR}/novels"
  touch "${APP_DIR}/.novels-score-7.5-imported"
fi

tar -xzf "${STAGING_DIR}/zhixuan-covers.tar.gz" -C "${APP_DIR}/covers"
chown -R 1000:1000 "${APP_DIR}/data"
chmod -R a+rX "${APP_DIR}/novels" "${APP_DIR}/covers"

docker load --input "${STAGING_DIR}/zhixuan-library-image.tar"
"${compose[@]}" --project-directory "${APP_DIR}" -f "${APP_DIR}/compose.production.yml" up -d

if [[ ! -f "/etc/nginx/sites-available/library.aivideoart.cn" ]]; then
  install -m 0644 "${STAGING_DIR}/nginx-library.conf" "/etc/nginx/sites-available/library.aivideoart.cn"
  ln -s "/etc/nginx/sites-available/library.aivideoart.cn" "/etc/nginx/sites-enabled/library.aivideoart.cn"
fi
nginx -t
systemctl reload nginx

for attempt in {1..20}; do
  if curl --fail --silent "http://127.0.0.1:6870/api/health" >/dev/null; then
    docker ps --filter "name=^/zhixuan-library$"
    echo "知轩书库部署成功。"
    rm -f \
      "${STAGING_DIR}/zhixuan-library-image.tar" \
      "${STAGING_DIR}/zhixuan-library.db" \
      "${STAGING_DIR}/zhixuan-covers.tar.gz" \
      "${STAGING_DIR}/zhixuan-novels-score-7.5-plus.tar.gz" \
      "${STAGING_DIR}/zhixuan-artifacts.sha256" \
      "${STAGING_DIR}/compose.production.yml" \
      "${STAGING_DIR}/.env.production" \
      "${STAGING_DIR}/nginx-library.conf" \
      "${STAGING_DIR}/install-release.sh"
    exit 0
  fi
  sleep 3
done

"${compose[@]}" --project-directory "${APP_DIR}" -f "${APP_DIR}/compose.production.yml" logs --tail 100
echo "容器未在预期时间内通过健康检查。" >&2
exit 1
