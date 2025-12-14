#!/bin/bash
# =============================================================================
# Docker Çöp Temizliği (Auto Prune)
# Haftalık çalıştırılması önerilir: crontab -e
# 0 4 * * 0 /path/to/docker-prune.sh >> /var/log/docker-prune.log 2>&1
# =============================================================================

set -e

echo "=============================================="
echo "Docker Cleanup - $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# Disk kullanımı (önce)
echo ""
echo "📊 Disk Usage (Before):"
df -h / | tail -1

echo ""
echo "🐳 Docker Disk Usage (Before):"
docker system df

# 1. Durmuş container'ları sil
echo ""
echo "🗑️  Removing stopped containers..."
docker container prune -f

# 2. Kullanılmayan image'ları sil (dangling)
echo ""
echo "🗑️  Removing dangling images..."
docker image prune -f

# 3. 7 günden eski kullanılmayan image'ları sil
echo ""
echo "🗑️  Removing unused images older than 7 days..."
docker image prune -a -f --filter "until=168h"

# 4. Kullanılmayan volume'ları sil (DİKKAT: veri kaybı olabilir)
# Sadece gerçekten kullanılmayan volume'lar silinir
echo ""
echo "🗑️  Removing unused volumes..."
docker volume prune -f

# 5. Kullanılmayan network'leri sil
echo ""
echo "🗑️  Removing unused networks..."
docker network prune -f

# 6. Build cache temizliği (7 günden eski)
echo ""
echo "🗑️  Removing build cache older than 7 days..."
docker builder prune -f --filter "until=168h"

# Disk kullanımı (sonra)
echo ""
echo "📊 Disk Usage (After):"
df -h / | tail -1

echo ""
echo "🐳 Docker Disk Usage (After):"
docker system df

echo ""
echo "✅ Docker cleanup completed!"
echo "=============================================="
