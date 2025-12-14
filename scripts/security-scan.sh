#!/bin/bash

# =============================================================================
# SUPPLY CHAIN SECURITY - DEPENDENCY SCANNING
# Stock Management System
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="./security-reports"
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   🔒 SUPPLY CHAIN SECURITY SCAN           ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

TOTAL_VULNS=0
CRITICAL_VULNS=0
HIGH_VULNS=0

# =============================================================================
# 1. NPM AUDIT
# =============================================================================

echo -e "${YELLOW}📦 Running npm audit...${NC}"
echo ""

npm_audit_output=$(npm audit --json 2>/dev/null || true)
npm_audit_file="$REPORT_DIR/npm-audit-$TIMESTAMP.json"

echo "$npm_audit_output" > "$npm_audit_file"

# Parse npm audit results
if command -v jq &> /dev/null; then
    npm_critical=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    npm_high=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
    npm_moderate=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
    npm_low=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
    npm_total=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "0")
    
    CRITICAL_VULNS=$((CRITICAL_VULNS + npm_critical))
    HIGH_VULNS=$((HIGH_VULNS + npm_high))
    TOTAL_VULNS=$((TOTAL_VULNS + npm_total))
else
    # Fallback without jq
    npm audit 2>&1 | head -20
    echo ""
fi

echo -e "${BLUE}NPM Audit Results:${NC}"
echo "  Critical: $npm_critical"
echo "  High: $npm_high"
echo "  Moderate: $npm_moderate"
echo "  Low: $npm_low"
echo "  Total: $npm_total"
echo ""
echo "  Report saved: $npm_audit_file"
echo ""

# =============================================================================
# 2. NPM OUTDATED CHECK
# =============================================================================

echo -e "${YELLOW}📋 Checking outdated packages...${NC}"
echo ""

outdated_file="$REPORT_DIR/npm-outdated-$TIMESTAMP.txt"
npm outdated > "$outdated_file" 2>&1 || true

outdated_count=$(wc -l < "$outdated_file" | tr -d ' ')
if [ "$outdated_count" -gt 1 ]; then
    echo -e "${YELLOW}⚠️  $((outdated_count - 1)) outdated packages found${NC}"
    head -10 "$outdated_file"
    echo "..."
else
    echo -e "${GREEN}✅ All packages are up to date${NC}"
fi
echo ""

# =============================================================================
# 3. TRIVY SCAN (if available)
# =============================================================================

if command -v trivy &> /dev/null; then
    echo -e "${YELLOW}🔍 Running Trivy filesystem scan...${NC}"
    echo ""
    
    trivy_file="$REPORT_DIR/trivy-$TIMESTAMP.json"
    trivy fs . --format json --output "$trivy_file" --severity CRITICAL,HIGH 2>/dev/null || true
    
    if [ -f "$trivy_file" ]; then
        if command -v jq &> /dev/null; then
            trivy_vulns=$(jq '[.Results[]?.Vulnerabilities // [] | length] | add // 0' "$trivy_file" 2>/dev/null || echo "0")
            echo "  Trivy vulnerabilities found: $trivy_vulns"
            TOTAL_VULNS=$((TOTAL_VULNS + trivy_vulns))
        fi
        echo "  Report saved: $trivy_file"
    fi
    echo ""
elif command -v docker &> /dev/null; then
    echo -e "${YELLOW}🔍 Running Trivy via Docker...${NC}"
    echo ""
    
    trivy_file="$REPORT_DIR/trivy-$TIMESTAMP.json"
    docker run --rm -v "$(pwd):/app" aquasec/trivy:latest fs /app --format json --severity CRITICAL,HIGH > "$trivy_file" 2>/dev/null || true
    
    if [ -s "$trivy_file" ]; then
        echo "  Report saved: $trivy_file"
    else
        echo "  Trivy scan skipped (Docker not available or failed)"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  Trivy not installed. Skipping container scan.${NC}"
    echo "  Install: https://github.com/aquasecurity/trivy"
    echo ""
fi

# =============================================================================
# 4. PACKAGE.JSON SECURITY CHECK
# =============================================================================

echo -e "${YELLOW}📄 Checking package.json security...${NC}"
echo ""

# Check for known malicious patterns
suspicious_packages=("event-stream" "flatmap-stream" "eslint-scope" "ua-parser-js")
found_suspicious=0

for pkg in "${suspicious_packages[@]}"; do
    if grep -q "\"$pkg\"" package.json 2>/dev/null; then
        echo -e "${RED}  ⚠️  Suspicious package found: $pkg${NC}"
        found_suspicious=$((found_suspicious + 1))
    fi
done

if [ $found_suspicious -eq 0 ]; then
    echo -e "${GREEN}  ✅ No known suspicious packages found${NC}"
fi
echo ""

# =============================================================================
# 5. SECRETS SCAN
# =============================================================================

echo -e "${YELLOW}🔐 Scanning for exposed secrets...${NC}"
echo ""

secrets_file="$REPORT_DIR/secrets-scan-$TIMESTAMP.txt"
secrets_found=0

# Check for common secret patterns
patterns=(
    "PRIVATE_KEY"
    "API_KEY.*=.*['\"][a-zA-Z0-9]{20,}['\"]"
    "password.*=.*['\"][^'\"]{8,}['\"]"
    "secret.*=.*['\"][a-zA-Z0-9]{16,}['\"]"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
)

for pattern in "${patterns[@]}"; do
    matches=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" -E "$pattern" . 2>/dev/null | grep -v node_modules | grep -v ".env" | grep -v "example" | grep -v "sample" || true)
    if [ -n "$matches" ]; then
        echo "$matches" >> "$secrets_file"
        secrets_found=$((secrets_found + 1))
    fi
done

if [ $secrets_found -gt 0 ]; then
    echo -e "${RED}  ⚠️  Potential secrets found! Check: $secrets_file${NC}"
else
    echo -e "${GREEN}  ✅ No exposed secrets detected${NC}"
fi
echo ""

# =============================================================================
# 6. LICENSE COMPLIANCE
# =============================================================================

echo -e "${YELLOW}📜 Checking license compliance...${NC}"
echo ""

if command -v npx &> /dev/null; then
    license_file="$REPORT_DIR/licenses-$TIMESTAMP.txt"
    npx license-checker --summary > "$license_file" 2>/dev/null || true
    
    # Check for problematic licenses
    problematic=("GPL-3.0" "AGPL" "SSPL")
    license_issues=0
    
    for lic in "${problematic[@]}"; do
        if grep -q "$lic" "$license_file" 2>/dev/null; then
            echo -e "${YELLOW}  ⚠️  Potentially problematic license: $lic${NC}"
            license_issues=$((license_issues + 1))
        fi
    done
    
    if [ $license_issues -eq 0 ]; then
        echo -e "${GREEN}  ✅ No license compliance issues detected${NC}"
    fi
    echo "  Report saved: $license_file"
else
    echo "  Skipped (npx not available)"
fi
echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   📊 SECURITY SCAN SUMMARY                ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "  Total Vulnerabilities: $TOTAL_VULNS"
echo "  Critical: $CRITICAL_VULNS"
echo "  High: $HIGH_VULNS"
echo "  Suspicious Packages: $found_suspicious"
echo "  Potential Secrets: $secrets_found"
echo ""
echo "  Reports saved to: $REPORT_DIR/"
echo ""

# Exit code based on severity
if [ $CRITICAL_VULNS -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL vulnerabilities found! Deployment blocked.${NC}"
    exit 1
elif [ $HIGH_VULNS -gt 5 ]; then
    echo -e "${RED}❌ Too many HIGH vulnerabilities! Deployment blocked.${NC}"
    exit 1
elif [ $HIGH_VULNS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  HIGH vulnerabilities found. Review before deployment.${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Security scan passed!${NC}"
    exit 0
fi
