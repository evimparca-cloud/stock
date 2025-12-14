#!/bin/bash

# =============================================================================
# DISASTER RECOVERY - DATABASE RESTORE SCRIPT
# Stock Management System
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_HOST="${PGHOST:-db}"
DB_USER="${PGUSER:-stockuser}"
DB_NAME="${PGDATABASE:-stockdb}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   DISASTER RECOVERY - DATABASE RESTORE     ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function to list available backups
list_backups() {
    echo -e "${YELLOW}📁 Available backups:${NC}"
    echo ""
    
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No backup files found"
        echo ""
        ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null || true
    else
        echo -e "${RED}Backup directory not found: $BACKUP_DIR${NC}"
        exit 1
    fi
    echo ""
}

# Function to validate backup file
validate_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file")
    if [ "$file_size" -lt 1000 ]; then
        echo -e "${RED}❌ Backup file too small (possibly corrupted): $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Backup file validated: $backup_file ($(numfmt --to=iec $file_size 2>/dev/null || echo "$file_size bytes"))${NC}"
}

# Function to create pre-restore backup
create_pre_restore_backup() {
    echo -e "${YELLOW}📦 Creating pre-restore backup...${NC}"
    
    local pre_restore_file="$BACKUP_DIR/pre_restore_$TIMESTAMP.sql.gz"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db pg_dump -U $DB_USER -d $DB_NAME | gzip > "$pre_restore_file"
    else
        PGPASSWORD=$PGPASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > "$pre_restore_file"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Pre-restore backup created: $pre_restore_file${NC}"
    else
        echo -e "${RED}❌ Failed to create pre-restore backup${NC}"
        echo -e "${YELLOW}⚠️  Continue anyway? (y/N)${NC}"
        read -r response
        if [ "$response" != "y" ]; then
            exit 1
        fi
    fi
}

# Function to decrypt backup file
decrypt_backup() {
    local encrypted_file=$1
    local output_file=$2
    
    if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
        echo -e "${RED}❌ BACKUP_ENCRYPTION_KEY not set${NC}"
        return 1
    fi
    
    log "🔓 Decrypting backup..."
    log "  OpenSSL version: $(openssl version | awk '{print $2}')"
    
    # OpenSSL 3 uyumlu decrypt (PBKDF2 + 100k iteration)
    openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 -md sha256 \
        -in "$encrypted_file" \
        -out "$output_file" \
        -pass pass:${BACKUP_ENCRYPTION_KEY}
    
    if [ $? -eq 0 ]; then
        log "  ${GREEN}✅ Decryption successful${NC}"
        return 0
    else
        log "  ${RED}❌ Decryption failed${NC}"
        return 1
    fi
}

# Function to restore database
restore_database() {
    local backup_file=$1
    local skip_pre_backup=${2:-false}
    
    echo -e "${BLUE}🔄 Starting database restore...${NC}"
    echo ""
    
    # Validate backup
    validate_backup "$backup_file"
    
    # Create pre-restore backup
    if [ "$skip_pre_backup" != "true" ]; then
        create_pre_restore_backup
    fi
    
    # Stop application
    echo -e "${YELLOW}🛑 Stopping application...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose stop app worker 2>/dev/null || true
    fi
    
    # Determine if file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        echo -e "${YELLOW}📂 Decompressing backup...${NC}"
        local temp_file="/tmp/restore_$TIMESTAMP.sql"
        gunzip -c "$backup_file" > "$temp_file"
        backup_file="$temp_file"
    fi
    
    # Drop and recreate database
    echo -e "${YELLOW}🗑️  Dropping existing database...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
        docker-compose exec -T db psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    else
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    fi
    
    # Restore data
    echo -e "${YELLOW}📥 Restoring data...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db psql -U $DB_USER -d $DB_NAME < "$backup_file"
    else
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME < "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database restored successfully!${NC}"
    else
        echo -e "${RED}❌ Database restore failed!${NC}"
        exit 1
    fi
    
    # Clean up temp file
    if [[ "$backup_file" == /tmp/* ]]; then
        rm -f "$backup_file"
    fi
    
    # Run migrations
    echo -e "${YELLOW}🔧 Running Prisma migrations...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose run --rm app npx prisma migrate deploy 2>/dev/null || true
    else
        npx prisma migrate deploy 2>/dev/null || true
    fi
    
    # Start application
    echo -e "${YELLOW}🚀 Starting application...${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose start app worker 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}   ✅ RESTORE COMPLETED SUCCESSFULLY!       ${NC}"
    echo -e "${GREEN}============================================${NC}"
}

# Function to verify restore
verify_restore() {
    echo -e "${YELLOW}🔍 Verifying restore...${NC}"
    
    # Check table counts
    local tables=("products" "orders" "users" "marketplaces" "product_mappings")
    
    for table in "${tables[@]}"; do
        local count
        if command -v docker-compose &> /dev/null; then
            count=$(docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
        else
            count=$(PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
        fi
        
        if [ -n "$count" ]; then
            echo -e "  ${GREEN}✓${NC} $table: $count records"
        else
            echo -e "  ${RED}✗${NC} $table: ERROR"
        fi
    done
    
    echo ""
}

# Function to run disaster recovery drill
run_drill() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   🎯 DISASTER RECOVERY DRILL               ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    
    echo -e "${YELLOW}This will:${NC}"
    echo "1. Create a fresh backup"
    echo "2. Add test data"
    echo "3. Restore from backup"
    echo "4. Verify data integrity"
    echo ""
    echo -e "${RED}⚠️  This is for testing purposes only!${NC}"
    echo -e "${YELLOW}Continue? (y/N)${NC}"
    read -r response
    
    if [ "$response" != "y" ]; then
        echo "Drill cancelled"
        exit 0
    fi
    
    # Step 1: Create backup
    echo -e "${YELLOW}Step 1: Creating backup...${NC}"
    local drill_backup="$BACKUP_DIR/drill_backup_$TIMESTAMP.sql.gz"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db pg_dump -U $DB_USER -d $DB_NAME | gzip > "$drill_backup"
    else
        PGPASSWORD=$PGPASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > "$drill_backup"
    fi
    
    # Get initial counts
    echo -e "${YELLOW}Step 2: Recording initial state...${NC}"
    local initial_product_count
    if command -v docker-compose &> /dev/null; then
        initial_product_count=$(docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM products;" | tr -d ' ')
    else
        initial_product_count=$(PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM products;" | tr -d ' ')
    fi
    echo "  Initial product count: $initial_product_count"
    
    # Step 3: Add test data
    echo -e "${YELLOW}Step 3: Adding test data...${NC}"
    local test_sku="DRILL_TEST_$TIMESTAMP"
    if command -v docker-compose &> /dev/null; then
        docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -c "INSERT INTO products (id, sku, name, \"stockQuantity\", price, \"createdAt\", \"updatedAt\") VALUES ('drill_$TIMESTAMP', '$test_sku', 'Drill Test Product', 100, 99.99, NOW(), NOW());" 2>/dev/null || true
    else
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "INSERT INTO products (id, sku, name, \"stockQuantity\", price, \"createdAt\", \"updatedAt\") VALUES ('drill_$TIMESTAMP', '$test_sku', 'Drill Test Product', 100, 99.99, NOW(), NOW());" 2>/dev/null || true
    fi
    echo "  Added test product: $test_sku"
    
    # Step 4: Restore from backup
    echo -e "${YELLOW}Step 4: Restoring from backup...${NC}"
    restore_database "$drill_backup" "true"
    
    # Step 5: Verify
    echo -e "${YELLOW}Step 5: Verifying restore...${NC}"
    local final_product_count
    if command -v docker-compose &> /dev/null; then
        final_product_count=$(docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM products;" | tr -d ' ')
    else
        final_product_count=$(PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM products;" | tr -d ' ')
    fi
    
    # Check if test product was removed
    local test_exists
    if command -v docker-compose &> /dev/null; then
        test_exists=$(docker-compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM products WHERE sku='$test_sku';" | tr -d ' ')
    else
        test_exists=$(PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM products WHERE sku='$test_sku';" | tr -d ' ')
    fi
    
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   DRILL RESULTS                            ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo "  Initial product count: $initial_product_count"
    echo "  Final product count: $final_product_count"
    echo "  Test product removed: $([ "$test_exists" == "0" ] && echo "YES ✓" || echo "NO ✗")"
    echo ""
    
    if [ "$initial_product_count" == "$final_product_count" ] && [ "$test_exists" == "0" ]; then
        echo -e "${GREEN}✅ DISASTER RECOVERY DRILL PASSED!${NC}"
        echo -e "${GREEN}Your backup system is working correctly.${NC}"
        
        # Clean up drill backup
        rm -f "$drill_backup"
    else
        echo -e "${RED}❌ DISASTER RECOVERY DRILL FAILED!${NC}"
        echo -e "${RED}Please investigate and fix backup system.${NC}"
        exit 1
    fi
}

# Main script
case "${1:-}" in
    list)
        list_backups
        ;;
    restore)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Usage: $0 restore <backup_file>${NC}"
            echo ""
            list_backups
            exit 1
        fi
        restore_database "$2"
        verify_restore
        ;;
    verify)
        verify_restore
        ;;
    drill)
        run_drill
        ;;
    *)
        echo "Usage: $0 {list|restore <file>|verify|drill}"
        echo ""
        echo "Commands:"
        echo "  list              - List available backups"
        echo "  restore <file>    - Restore from backup file"
        echo "  verify            - Verify current database state"
        echo "  drill             - Run disaster recovery drill"
        echo ""
        exit 1
        ;;
esac
