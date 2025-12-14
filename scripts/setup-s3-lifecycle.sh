#!/bin/bash
# =============================================================================
# S3/SPACES LIFECYCLE KURAL AYARLAMA
# 30 gün sonra otomatik silme
# =============================================================================

set -e

echo "🪣 S3 Lifecycle kuralı ayarlanıyor..."

# Gerekli değişkenler
if [ -z "$AWS_S3_BUCKET" ]; then
    echo "❌ AWS_S3_BUCKET ayarlanmamış"
    exit 1
fi

# Lifecycle kuralı JSON
LIFECYCLE_POLICY='{
    "Rules": [
        {
            "ID": "DeleteOldBackups",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "backups/"
            },
            "Expiration": {
                "Days": 30
            }
        }
    ]
}'

# AWS CLI ile lifecycle kuralını ayarla
if [ -n "$AWS_S3_ENDPOINT" ]; then
    # DigitalOcean Spaces
    echo "$LIFECYCLE_POLICY" | aws s3api put-bucket-lifecycle-configuration \
        --bucket $AWS_S3_BUCKET \
        --lifecycle-configuration file:///dev/stdin \
        --endpoint-url $AWS_S3_ENDPOINT
else
    # AWS S3
    echo "$LIFECYCLE_POLICY" | aws s3api put-bucket-lifecycle-configuration \
        --bucket $AWS_S3_BUCKET \
        --lifecycle-configuration file:///dev/stdin
fi

echo "✅ Lifecycle kuralı ayarlandı: backups/ içindeki dosyalar 30 gün sonra silinecek"

# Mevcut kuralları göster
echo ""
echo "📋 Mevcut Lifecycle Kuralları:"
if [ -n "$AWS_S3_ENDPOINT" ]; then
    aws s3api get-bucket-lifecycle-configuration \
        --bucket $AWS_S3_BUCKET \
        --endpoint-url $AWS_S3_ENDPOINT 2>/dev/null || echo "Kural yok"
else
    aws s3api get-bucket-lifecycle-configuration \
        --bucket $AWS_S3_BUCKET 2>/dev/null || echo "Kural yok"
fi
