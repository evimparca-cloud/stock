#!/bin/bash

# =============================================================================
# POSTGRESQL MAINTENANCE SCRIPT
# Vacuum, Analyze, Reindex - Stok sistemleri için kritik
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_HOST="${PGHOST:-db}"
DB_USER="${PGUSER:-stockuser}"
DB_NAME="${PGDATABASE:-stockdb}"
LOG_DIR="./logs/maintenance"

mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/maintenance_$TIMESTAMP.log"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   PostgreSQL Maintenance Script           ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# =============================================================================
# 1. DATABASE SIZE CHECK
# =============================================================================

log "📊 Checking database size..."

if command -v docker-compose &> /dev/null; then
    DB_SIZE=$(docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
else
    DB_SIZE=$(PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
fi

log "  Database size: $DB_SIZE"
echo ""

# =============================================================================
# 2. TABLE BLOAT CHECK
# =============================================================================

log "🔍 Checking table bloat..."

BLOAT_QUERY="
SELECT 
    schemaname || '.' || relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as table_size,
    n_dead_tup as dead_tuples,
    n_live_tup as live_tuples,
    CASE 
        WHEN n_live_tup > 0 THEN round(100.0 * n_dead_tup / n_live_tup, 2)
        ELSE 0 
    END as dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 10;
"

if command -v docker-compose &> /dev/null; then
    docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "$BLOAT_QUERY" | tee -a "$LOG_FILE"
else
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "$BLOAT_QUERY" | tee -a "$LOG_FILE"
fi

echo ""

# =============================================================================
# 3. VACUUM ANALYZE
# =============================================================================

log "🧹 Running VACUUM ANALYZE..."

# Kritik tablolar için VACUUM
TABLES=("products" "orders" "order_items" "stock_logs" "product_mappings" "audit_logs")

for table in "${TABLES[@]}"; do
    log "  Vacuuming $table..."
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE $table;" 2>&1 | tee -a "$LOG_FILE"
    else
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE $table;" 2>&1 | tee -a "$LOG_FILE"
    fi
done

log "  ✅ VACUUM ANALYZE completed"
echo ""

# =============================================================================
# 4. FULL VACUUM (Opsiyonel - Dikkat: Tablo kilitler!)
# =============================================================================

if [ "${1:-}" == "--full" ]; then
    log "⚠️  Running VACUUM FULL (tables will be locked!)..."
    
    echo -e "${YELLOW}This will lock tables. Continue? (y/N)${NC}"
    read -r response
    
    if [ "$response" == "y" ]; then
        for table in "${TABLES[@]}"; do
            log "  VACUUM FULL on $table..."
            if command -v docker-compose &> /dev/null; then
                docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "VACUUM FULL $table;"
            else
                PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM FULL $table;"
            fi
        done
        log "  ✅ VACUUM FULL completed"
    else
        log "  ⏭️  VACUUM FULL skipped"
    fi
    echo ""
fi

# =============================================================================
# 5. REINDEX (Opsiyonel)
# =============================================================================

if [ "${1:-}" == "--reindex" ] || [ "${2:-}" == "--reindex" ]; then
    log "🔧 Running REINDEX..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "REINDEX DATABASE $DB_NAME;"
    else
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "REINDEX DATABASE $DB_NAME;"
    fi
    
    log "  ✅ REINDEX completed"
    echo ""
fi

# =============================================================================
# 6. UPDATE STATISTICS
# =============================================================================

log "📈 Updating statistics..."

if command -v docker-compose &> /dev/null; then
    docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "ANALYZE;"
else
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "ANALYZE;"
fi

log "  ✅ Statistics updated"
echo ""

# =============================================================================
# 7. CHECK INDEX USAGE
# =============================================================================

log "📋 Checking index usage..."

INDEX_QUERY="
SELECT 
    schemaname || '.' || relname as table_name,
    indexrelname as index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE idx_scan < 50
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;
"

log "  Unused indexes (potential candidates for removal):"
if command -v docker-compose &> /dev/null; then
    docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "$INDEX_QUERY" | tee -a "$LOG_FILE"
else
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "$INDEX_QUERY" | tee -a "$LOG_FILE"
fi

echo ""

# =============================================================================
# 8. CHECK AUTOVACUUM SETTINGS
# =============================================================================

log "⚙️  Checking autovacuum settings..."

AUTOVACUUM_QUERY="
SELECT name, setting, unit, short_desc 
FROM pg_settings 
WHERE name LIKE 'autovacuum%' 
ORDER BY name;
"

if command -v docker-compose &> /dev/null; then
    docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "$AUTOVACUUM_QUERY" | tee -a "$LOG_FILE"
else
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "$AUTOVACUUM_QUERY" | tee -a "$LOG_FILE"
fi

echo ""

# =============================================================================
# 9. FINAL SIZE CHECK
# =============================================================================

log "📊 Final database size..."

if command -v docker-compose &> /dev/null; then
    FINAL_SIZE=$(docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
else
    FINAL_SIZE=$(PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
fi

log "  Final size: $FINAL_SIZE"
echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   ✅ Maintenance Completed                ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Initial size: $DB_SIZE"
echo "  Final size: $FINAL_SIZE"
echo "  Log file: $LOG_FILE"
echo ""
echo -e "${BLUE}Recommended schedule:${NC}"
echo "  - VACUUM ANALYZE: Daily (off-peak hours)"
echo "  - VACUUM FULL: Monthly (maintenance window)"
echo "  - REINDEX: Monthly or as needed"
echo ""
echo -e "${YELLOW}To add to crontab:${NC}"
echo "  0 3 * * * /path/to/scripts/db-maintenance.sh >> /var/log/db-maintenance.log 2>&1"
echo ""
