#!/bin/bash

# CORS Test Script for Production Deployment
echo "🔍 Testing CORS Configuration..."
echo "================================="

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s -H "Origin: https://hssm-services.web.app" \
     https://hssm-2-1.onrender.com/api/health | jq . 2>/dev/null || echo "Health check response"

echo ""
echo "2. Testing CORS preflight (OPTIONS)..."
curl -s -X OPTIONS \
     -H "Origin: https://hssm-services.web.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -v \
     https://hssm-2-1.onrender.com/api/auth/login 2>&1 | grep -E "(Access-Control|HTTP/|origin)"

echo ""
echo "3. Testing CORS test endpoint..."
curl -s -H "Origin: https://hssm-services.web.app" \
     https://hssm-2-1.onrender.com/api/test-cors | jq . 2>/dev/null || echo "CORS test response"

echo ""
echo "✅ CORS tests completed!"
echo "If you see Access-Control-Allow-Origin headers in the responses, CORS is working correctly."
