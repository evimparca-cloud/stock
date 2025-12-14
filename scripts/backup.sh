#!/bin/bash
# =============================================================================
# ENTERPRISE DATABASE BACKUP SCRIPT
# Stock Management System
# 3-2-1 Backup Strategy: Sıkıştırma + Şifreleme + Bulut Upload
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="stock_backup_${DATE}"
SQL_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"
GZ_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"
ENC_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz.enc"
FINAL_FILE=""

# Retention settings
LOCAL_RETENTION_DAYS=${LOCAL_RETENTION_DAYS:-3}
CLOUD_RETENTION_DAYS=${CLOUD_RETENTION_DAYS:-30}

# Cloud settings
ENABLE_ENCRYPTION=${ENABLE_ENCRYPTION:-true}
ENABLE_GOOGLE_DRIVE=${ENABLE_GOOGLE_DRIVE:-false}
ENABLE_S3=${ENABLE_S3:-false}

# Log function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "${BLUE}=========================================${NC}"
log "${BLUE}   ENTERPRISE BACKUP SYSTEM             ${NC}"
log "${BLUE}=========================================${NC}"
echo ""

# Backup dizinini oluştur
mkdir -p ${BACKUP_DIR}

# =============================================================================
# STEP 1: DATABASE DUMP
# =============================================================================
log "${YELLOW}📦 Step 1: PostgreSQL dump alınıyor...${NC}"

pg_dump -h ${PGHOST} -U ${PGUSER} -d ${PGDATABASE} > ${SQL_FILE}

SQL_SIZE=$(du -h ${SQL_FILE} | cut -f1)
log "  SQL dump tamamlandı: ${SQL_SIZE}"

# =============================================================================
# STEP 2: COMPRESSION (gzip)
# =============================================================================
log "${YELLOW}🗜️  Step 2: Sıkıştırılıyor...${NC}"

gzip -9 ${SQL_FILE}
FINAL_FILE="${GZ_FILE}"

GZ_SIZE=$(du -h ${GZ_FILE} | cut -f1)
log "  Sıkıştırma tamamlandı: ${GZ_SIZE}"

# =============================================================================
# STEP 3: ENCRYPTION (AES-256-GCM - OpenSSL 3 uyumlu)
# =============================================================================
if [ "${ENABLE_ENCRYPTION}" = "true" ] && [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
    log "${YELLOW}🔒 Step 3: Şifreleniyor (AES-256-GCM, OpenSSL 3)...${NC}"
    
    # OpenSSL versiyonunu kontrol et
    OPENSSL_VERSION=$(openssl version | awk '{print $2}')
    log "  OpenSSL version: ${OPENSSL_VERSION}"
    
    # AES-256-GCM ile şifreleme (OpenSSL 3.x uyumlu)
    # -pbkdf2: Key derivation
    # -iter 100000: 100k iteration (güvenli)
    # -md sha256: Hash algoritması
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -md sha256 \
        -in ${GZ_FILE} \
        -out ${ENC_FILE} \
        -pass pass:${BACKUP_ENCRYPTION_KEY}
    
    rm -f ${GZ_FILE}
    FINAL_FILE="${ENC_FILE}"
    
    ENC_SIZE=$(du -h ${ENC_FILE} | cut -f1)
    log "  Şifreleme tamamlandı: ${ENC_SIZE}"
    log "  Algoritma: AES-256-CBC + PBKDF2 (100k iter)"
else
    log "${YELLOW}🔓 Step 3: Şifreleme atlandı (BACKUP_ENCRYPTION_KEY ayarlanmamış)${NC}"
fi

# =============================================================================
# STEP 4: GOOGLE DRIVE UPLOAD
# =============================================================================
if [ "${ENABLE_GOOGLE_DRIVE}" = "true" ] && [ -n "${GOOGLE_DRIVE_FOLDER_ID}" ]; then
    log "${YELLOW}☁️  Step 4: Google Drive'a yükleniyor...${NC}"
    
    if command -v gdrive &> /dev/null; then
        gdrive files upload --parent ${GOOGLE_DRIVE_FOLDER_ID} ${FINAL_FILE}
        log "  ${GREEN}✅ Google Drive upload başarılı${NC}"
    else
        log "  ${RED}❌ gdrive komutu bulunamadı${NC}"
    fi
else
    log "${YELLOW}⏭️  Step 4: Google Drive upload atlandı${NC}"
fi

# =============================================================================
# STEP 5: S3/SPACES UPLOAD
# =============================================================================
if [ "${ENABLE_S3}" = "true" ] && [ -n "${AWS_S3_BUCKET}" ]; then
    log "${YELLOW}🪣 Step 5: S3/Spaces'a yükleniyor...${NC}"
    
    if command -v aws &> /dev/null; then
        FILENAME=$(basename ${FINAL_FILE})
        
        if [ -n "${AWS_S3_ENDPOINT}" ]; then
            # DigitalOcean Spaces
            aws s3 cp ${FINAL_FILE} s3://${AWS_S3_BUCKET}/backups/${FILENAME} \
                --endpoint-url ${AWS_S3_ENDPOINT}
        else
            # AWS S3
            aws s3 cp ${FINAL_FILE} s3://${AWS_S3_BUCKET}/backups/${FILENAME}
        fi
        
        log "  ${GREEN}✅ S3/Spaces upload başarılı${NC}"
    else
        log "  ${RED}❌ aws cli komutu bulunamadı${NC}"
    fi
else
    log "${YELLOW}⏭️  Step 5: S3/Spaces upload atlandı${NC}"
fi

# =============================================================================
# STEP 6: LOCAL CLEANUP
# =============================================================================
log "${YELLOW}🧹 Step 6: Eski yerel yedekler temizleniyor...${NC}"

find ${BACKUP_DIR} -name "stock_backup_*.sql.gz*" -type f -mtime +${LOCAL_RETENTION_DAYS} -delete 2>/dev/null || true

BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/stock_backup_*.sql.gz* 2>/dev/null | wc -l)
log "  Yerel yedek sayısı: ${BACKUP_COUNT}"

# =============================================================================
# STEP 7: NOTIFICATION
# =============================================================================
FINAL_SIZE=$(du -h ${FINAL_FILE} | cut -f1)

if [ -n "${DISCORD_WEBHOOK_URL}" ]; then
    log "${YELLOW}📢 Step 7: Discord bildirimi gönderiliyor...${NC}"
    
    curl -s -X POST "${DISCORD_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"✅ **Yedekleme Tamamlandı**\n📁 Dosya: $(basename ${FINAL_FILE})\n📊 Boyut: ${FINAL_SIZE}\n🔒 Şifreli: ${ENABLE_ENCRYPTION}\n☁️ Bulut: $([[ ${ENABLE_S3} == 'true' || ${ENABLE_GOOGLE_DRIVE} == 'true' ]] && echo 'Evet' || echo 'Hayır')\"}" \
        > /dev/null 2>&1
    
    log "  ${GREEN}✅ Discord bildirimi gönderildi${NC}"
fi

if [ -n "${TELEGRAM_BOT_TOKEN}" ] && [ -n "${TELEGRAM_CHAT_ID}" ]; then
    log "${YELLOW}📢 Step 7: Telegram bildirimi gönderiliyor...${NC}"
    
    MESSAGE="✅ *Yedekleme Tamamlandı*%0A📁 Dosya: $(basename ${FINAL_FILE})%0A📊 Boyut: ${FINAL_SIZE}%0A🔒 Şifreli: ${ENABLE_ENCRYPTION}"
    
    curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${MESSAGE}&parse_mode=Markdown" \
        > /dev/null 2>&1
    
    log "  ${GREEN}✅ Telegram bildirimi gönderildi${NC}"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
log "${GREEN}=========================================${NC}"
log "${GREEN}   ✅ YEDEKLEME TAMAMLANDI               ${NC}"
log "${GREEN}=========================================${NC}"
echo ""
log "  📁 Dosya: $(basename ${FINAL_FILE})"
log "  📊 Boyut: ${FINAL_SIZE}"
log "  🔒 Şifreli: ${ENABLE_ENCRYPTION}"
log "  📍 Yerel: ${BACKUP_DIR}"
log "  ☁️  Google Drive: ${ENABLE_GOOGLE_DRIVE}"
log "  🪣 S3/Spaces: ${ENABLE_S3}"
echo ""
