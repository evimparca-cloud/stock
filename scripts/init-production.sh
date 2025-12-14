#!/bin/bash

# =============================================================================
# PRODUCTION INITIALIZATION SCRIPT
# Stock Management System - Enterprise Setup
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting Production Initialization..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# CONFIGURATION
# =============================================================================

DOMAIN=${DOMAIN:-"your-domain.com"}
EMAIL=${EMAIL:-"admin@your-domain.com"}
DB_NAME=${DB_NAME:-"stockdb"}
DB_USER=${DB_USER:-"stockuser"}
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@company.com"}
ADMIN_NAME=${ADMIN_NAME:-"System Admin"}

echo -e "${BLUE}Configuration:${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Database: $DB_NAME"
echo "Admin Email: $ADMIN_EMAIL"
echo ""

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

echo -e "${YELLOW}📋 Setting up environment...${NC}"

# Create .env.production if not exists
if [ ! -f .env.production ]; then
    echo "Creating .env.production..."
    
    # Generate secure secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    cat > .env.production << EOF
# =============================================================================
# PRODUCTION ENVIRONMENT VARIABLES
# =============================================================================

NODE_ENV=production

# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# Redis
REDIS_URL=redis://redis:6379

# NextAuth
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
JWT_SECRET=${JWT_SECRET}

# Encryption (for API keys)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Discord Webhook (optional)
DISCORD_WEBHOOK_URL=

# Marketplace APIs (will be encrypted in database)
TRENDYOL_API_KEY=
TRENDYOL_API_SECRET=
TRENDYOL_SELLER_ID=

# Admin User
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_NAME=${ADMIN_NAME}
ADMIN_PASSWORD=
EOF

    echo -e "${GREEN}✅ .env.production created${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env.production and add your API keys${NC}"
else
    echo -e "${GREEN}✅ .env.production already exists${NC}"
fi

# =============================================================================
# DOCKER SETUP
# =============================================================================

echo -e "${YELLOW}🐳 Setting up Docker...${NC}"

# Create necessary directories
mkdir -p nginx/conf.d
mkdir -p certbot/conf
mkdir -p certbot/www
mkdir -p backups
mkdir -p logs

# Set permissions
chmod 755 nginx/conf.d
chmod 755 certbot/conf
chmod 755 certbot/www
chmod 755 backups
chmod 755 logs

echo -e "${GREEN}✅ Docker directories created${NC}"

# =============================================================================
# SSL CERTIFICATE
# =============================================================================

echo -e "${YELLOW}🔒 Setting up SSL certificate...${NC}"

# Check if certificate already exists
if [ ! -f "certbot/conf/live/${DOMAIN}/fullchain.pem" ]; then
    echo "Obtaining SSL certificate for ${DOMAIN}..."
    
    # Start nginx temporarily for certificate validation
    docker-compose up -d nginx
    sleep 5
    
    # Get certificate
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email ${EMAIL} \
        --agree-tos \
        --no-eff-email \
        -d ${DOMAIN}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL certificate obtained${NC}"
    else
        echo -e "${RED}❌ Failed to obtain SSL certificate${NC}"
        echo -e "${YELLOW}⚠️  Continuing with self-signed certificate...${NC}"
        
        # Create self-signed certificate as fallback
        mkdir -p certbot/conf/live/${DOMAIN}
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout certbot/conf/live/${DOMAIN}/privkey.pem \
            -out certbot/conf/live/${DOMAIN}/fullchain.pem \
            -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Company/CN=${DOMAIN}"
    fi
else
    echo -e "${GREEN}✅ SSL certificate already exists${NC}"
fi

# =============================================================================
# DATABASE MIGRATION
# =============================================================================

echo -e "${YELLOW}🗄️  Setting up database...${NC}"

# Start database
docker-compose up -d db redis
sleep 10

# Wait for database to be ready
echo "Waiting for database to be ready..."
until docker-compose exec -T db pg_isready -U ${DB_USER} -d ${DB_NAME}; do
    echo "Database is not ready yet..."
    sleep 2
done

echo -e "${GREEN}✅ Database is ready${NC}"

# Run migrations (IMPORTANT: migrate deploy, NOT db push!)
echo "Running database migrations..."
echo -e "${YELLOW}⚠️  Using 'prisma migrate deploy' (safe for production)${NC}"
docker-compose run --rm app npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️  Migration failed, trying to create initial migration...${NC}"
    # İlk kurulumda migration yoksa oluştur
    docker-compose run --rm app npx prisma migrate dev --name init --create-only
    docker-compose run --rm app npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Initial migration created and deployed${NC}"
    else
        echo -e "${RED}❌ Database migration failed${NC}"
        echo -e "${YELLOW}Manual fix: Run 'npx prisma migrate dev' locally first${NC}"
        exit 1
    fi
fi

# =============================================================================
# ADMIN USER CREATION
# =============================================================================

echo -e "${YELLOW}👤 Creating admin user...${NC}"

# Generate admin password if not set
if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$(openssl rand -base64 12)
    echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> .env.production
fi

# Create admin user
docker-compose run --rm app node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function createAdmin() {
    const prisma = new PrismaClient();
    
    try {
        const hashedPassword = await bcrypt.hash('${ADMIN_PASSWORD}', 12);
        
        const admin = await prisma.user.upsert({
            where: { email: '${ADMIN_EMAIL}' },
            update: {
                name: '${ADMIN_NAME}',
                role: 'admin',
                password: hashedPassword,
            },
            create: {
                email: '${ADMIN_EMAIL}',
                name: '${ADMIN_NAME}',
                role: 'admin',
                password: hashedPassword,
                emailVerified: new Date(),
            },
        });
        
        console.log('✅ Admin user created:', admin.email);
    } catch (error) {
        console.error('❌ Failed to create admin user:', error);
        process.exit(1);
    } finally {
        await prisma.\$disconnect();
    }
}

createAdmin();
"

echo -e "${GREEN}✅ Admin user created${NC}"
echo -e "${BLUE}Admin Credentials:${NC}"
echo "Email: ${ADMIN_EMAIL}"
echo "Password: ${ADMIN_PASSWORD}"
echo ""

# =============================================================================
# START SERVICES
# =============================================================================

echo -e "${YELLOW}🚀 Starting all services...${NC}"

# Build and start all services
docker-compose up -d --build

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Check service health
echo -e "${BLUE}Service Status:${NC}"
docker-compose ps

# Test application
echo -e "${YELLOW}🧪 Testing application...${NC}"

# Test health endpoint
if curl -f -s "https://${DOMAIN}/api/system/health" > /dev/null; then
    echo -e "${GREEN}✅ Application is healthy${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
    echo "Checking logs..."
    docker-compose logs app | tail -20
fi

# =============================================================================
# SECURITY SETUP
# =============================================================================

echo -e "${YELLOW}🔒 Applying security configurations...${NC}"

# Set up log rotation
cat > /etc/logrotate.d/docker-stock << EOF
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF

# Set up firewall rules (if ufw is available)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}✅ Firewall configured${NC}"
fi

# =============================================================================
# BACKUP SETUP
# =============================================================================

echo -e "${YELLOW}💾 Setting up backup system...${NC}"

# Create backup script
cat > scripts/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

echo "Starting backup at $(date)"

# Database backup
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE > "${BACKUP_DIR}/db_backup_${DATE}.sql"

if [ $? -eq 0 ]; then
    echo "✅ Database backup completed: db_backup_${DATE}.sql"
    
    # Compress backup
    gzip "${BACKUP_DIR}/db_backup_${DATE}.sql"
    echo "✅ Backup compressed"
    
    # Remove old backups
    find ${BACKUP_DIR} -name "db_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    echo "✅ Old backups cleaned up"
else
    echo "❌ Database backup failed"
    exit 1
fi

echo "Backup completed at $(date)"
EOF

chmod +x scripts/backup.sh

echo -e "${GREEN}✅ Backup system configured${NC}"

# =============================================================================
# MONITORING SETUP
# =============================================================================

echo -e "${YELLOW}📊 Setting up monitoring...${NC}"

# Create monitoring script
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

# Check service health
check_service() {
    local service=$1
    if docker-compose ps $service | grep -q "Up"; then
        echo "✅ $service is running"
        return 0
    else
        echo "❌ $service is down"
        return 1
    fi
}

echo "=== System Health Check ==="
echo "Date: $(date)"
echo ""

# Check all services
services=("app" "db" "redis" "nginx" "worker")
failed_services=()

for service in "${services[@]}"; do
    if ! check_service $service; then
        failed_services+=($service)
    fi
done

# Check disk space
echo ""
echo "=== Disk Usage ==="
df -h

# Check memory usage
echo ""
echo "=== Memory Usage ==="
free -h

# Check Docker stats
echo ""
echo "=== Docker Stats ==="
docker stats --no-stream

# Send alert if services are down
if [ ${#failed_services[@]} -gt 0 ]; then
    echo ""
    echo "❌ Failed services: ${failed_services[*]}"
    
    # Send Discord notification if webhook is configured
    if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{\"content\":\"🚨 **System Alert**: Services down: ${failed_services[*]}\"}" \
             $DISCORD_WEBHOOK_URL
    fi
    
    exit 1
else
    echo ""
    echo "✅ All services are healthy"
fi
EOF

chmod +x scripts/monitor.sh

# Add monitoring cron job
(crontab -l 2>/dev/null; echo "*/5 * * * * /path/to/your/project/scripts/monitor.sh >> /var/log/stock-monitor.log 2>&1") | crontab -

echo -e "${GREEN}✅ Monitoring configured${NC}"

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo -e "${GREEN}🎉 Production setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}=== IMPORTANT INFORMATION ===${NC}"
echo "Domain: https://${DOMAIN}"
echo "Admin Email: ${ADMIN_EMAIL}"
echo "Admin Password: ${ADMIN_PASSWORD}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your DNS to point to this server"
echo "2. Edit .env.production with your API keys"
echo "3. Configure your marketplace integrations"
echo "4. Set up monitoring alerts"
echo "5. Test the backup system"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "- View logs: docker-compose logs -f"
echo "- Restart services: docker-compose restart"
echo "- Update application: docker-compose pull && docker-compose up -d"
echo "- Manual backup: docker-compose exec backup /backup.sh"
echo "- Health check: ./scripts/monitor.sh"
echo ""
echo -e "${GREEN}🚀 Your Stock Management System is ready!${NC}"
