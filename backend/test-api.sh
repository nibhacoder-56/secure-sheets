#!/bin/bash
# ============================================================
# Secure Sheets – Quick API Test Script
# Run this after starting the backend to verify it works.
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:4000/api}"
EMAIL="admin@example.com"
PASSWORD="TestPass123!"

echo "=========================================="
echo "  Secure Sheets API Health & Smoke Test"
echo "=========================================="
echo ""

# 1. Health check
echo "1. Health check..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | head -c 300
echo ""
echo ""

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed – is the server running?"
  echo "   Start it with: cd backend && npm run start:dev"
  exit 1
fi

echo ""
echo "2. Register a test user..."
REGISTER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test Admin\"}")

echo "$REGISTER" | head -c 400
echo ""
echo ""

ACCESS_TOKEN=$(echo "$REGISTER" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "⚠️  Register may have failed (user might already exist). Trying login..."
  LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  ACCESS_TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Could not get access token"
  exit 1
fi

echo "✅ Got access token: ${ACCESS_TOKEN:0:20}..."
echo ""

echo "3. List organizations (should be empty or list)..."
ORGS=$(curl -s "$BASE_URL/organizations" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$ORGS" | head -c 300
echo ""
echo ""

echo "=========================================="
echo "  Basic smoke test finished"
echo "=========================================="
echo ""
echo "Next manual tests you can do:"
echo "  • POST $BASE_URL/auth/register"
echo "  • POST $BASE_URL/auth/login"
echo "  • GET  $BASE_URL/health"
echo "  • GET  $BASE_URL/organizations   (with Bearer token)"
echo ""
echo "Full permission grant example:"
echo '  curl -X POST http://localhost:4000/api/permissions/grant \'
echo '    -H "Authorization: Bearer YOUR_TOKEN" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"email":"user@company.com","sheetIds":["SHEET_ID"],"permission":"EDITOR"}'"'"
echo ""
