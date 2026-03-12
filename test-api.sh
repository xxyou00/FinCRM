#!/bin/bash

echo "🧪 Testing FinCRM API..."
echo ""

# Test login
echo "1️⃣ Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fincrm.com","password":"admin123"}')

echo "Response: $LOGIN_RESPONSE"
echo ""

# Extract token (simple grep, works for testing)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful!"
echo ""

# Test get users
echo "2️⃣ Testing get users..."
USERS_RESPONSE=$(curl -s http://localhost:3000/api/users \
  -H "Cookie: token=$TOKEN")

echo "Response: $USERS_RESPONSE"
echo ""

if echo "$USERS_RESPONSE" | grep -q "users"; then
  echo "✅ Get users successful!"
else
  echo "❌ Get users failed!"
fi

echo ""

# Test get leads
echo "3️⃣ Testing get leads..."
LEADS_RESPONSE=$(curl -s http://localhost:3000/api/leads \
  -H "Cookie: token=$TOKEN")

echo "Response: $LEADS_RESPONSE"
echo ""

if echo "$LEADS_RESPONSE" | grep -q "leads"; then
  echo "✅ Get leads successful!"
else
  echo "❌ Get leads failed!"
fi

echo ""
echo "🎉 API tests completed!"
