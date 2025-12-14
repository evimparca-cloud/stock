#!/bin/bash
# =============================================================================
# Let's Encrypt SSL Certificate Setup Script
# Stock Management System
# Tek komutla SSL sertifikası alma ve otomatik yenileme
# =============================================================================

set -e

# Configuration - Bunları değiştirin!
DOMAIN="${1:-example.com}"
EMAIL="${2:-admin@example.com}"
STAGING="${3:-0}"  # 1 = staging (test), 0 = production

# Paths
DATA_PATH="./certbot"
RSA_KEY_SIZE=4096

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Banner
echo "============================================="
echo "  Let's Encrypt SSL Setup Script"
echo "  Stock Management System"
echo "============================================="
echo ""

# Parametre kontrolü
if [ "$DOMAIN" == "example.com" ]; then
    error "Lütfen domain adını parametre olarak girin: ./init-letsencrypt.sh yourdomain.com your@email.com"
fi

log "Domain: $DOMAIN"
log "Email: $EMAIL"
log "Staging: $([ $STAGING == "1" ] && echo "Evet (Test)" || echo "Hayır (Production)")"
echo ""

# Docker kontrolü
if ! command -v docker &> /dev/null; then
    error "Docker yüklü değil!"
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "Docker Compose yüklü değil!"
fi

# Dizin oluştur
log "Certbot dizinleri oluşturuluyor..."
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

# Mevcut sertifika kontrolü
if [ -d "$DATA_PATH/conf/live/$DOMAIN" ]; then
    warn "Mevcut sertifika bulundu: $DOMAIN"
    read -p "Mevcut sertifikayı silip yeniden oluşturmak istiyor musunuz? (y/N) " decision
    if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
        log "İşlem iptal edildi."
        exit 0
    fi
    rm -rf "$DATA_PATH/conf/live/$DOMAIN"
    rm -rf "$DATA_PATH/conf/archive/$DOMAIN"
    rm -rf "$DATA_PATH/conf/renewal/$DOMAIN.conf"
fi

# Nginx config için geçici dosya oluştur
log "Geçici Nginx yapılandırması oluşturuluyor..."
cat > ./nginx/conf.d/default.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'SSL Setup in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

# DH parameters oluştur
if [ ! -f "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
    log "DH parameters oluşturuluyor (bu biraz zaman alabilir)..."
    openssl dhparam -out "$DATA_PATH/conf/ssl-dhparams.pem" 2048
fi

# Let's Encrypt recommended options
if [ ! -f "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
    log "SSL options dosyası indiriliyor..."
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
fi

# Nginx başlat
log "Nginx başlatılıyor..."
docker-compose up -d nginx

# Nginx'in başlamasını bekle
sleep 5

# Staging parametresi
staging_arg=""
if [ $STAGING != "0" ]; then
    staging_arg="--staging"
    warn "STAGING modu aktif - gerçek sertifika alınmayacak!"
fi

# Sertifika al
log "Let's Encrypt sertifikası alınıyor..."
docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    --email $EMAIL \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d www.$DOMAIN" certbot

# Başarı kontrolü
if [ -d "$DATA_PATH/conf/live/$DOMAIN" ]; then
    log "SSL sertifikası başarıyla oluşturuldu!"
else
    error "SSL sertifikası oluşturulamadı!"
fi

# Production Nginx config'i geri yükle
log "Nginx yapılandırması güncelleniyor..."
rm ./nginx/conf.d/default.conf

# Domain değişkenini app.conf'a uygula
sed -i "s/\${DOMAIN}/$DOMAIN/g" ./nginx/conf.d/app.conf

# Nginx'i yeniden başlat
log "Nginx yeniden başlatılıyor..."
docker-compose restart nginx

# Sertifika bilgilerini göster
log "Sertifika bilgileri:"
docker-compose run --rm --entrypoint "\
  certbot certificates" certbot

echo ""
echo "============================================="
echo -e "${GREEN}  SSL Kurulumu Tamamlandı!${NC}"
echo "============================================="
echo ""
echo "Önemli Notlar:"
echo "1. Sertifika 90 gün geçerlidir"
echo "2. Otomatik yenileme için certbot servisi çalışıyor"
echo "3. Yenileme her 12 saatte bir kontrol edilir"
echo ""
echo "Manuel yenileme için:"
echo "  docker-compose run --rm certbot renew"
echo ""
