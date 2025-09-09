# 🚀 Production Deployment Guide - CORS Fixed

## ✅ CORS Configuration - Permanent Fix

The CORS issue has been resolved with a robust, production-ready configuration that:

- ✅ Handles preflight requests properly
- ✅ Works in both development and production
- ✅ Supports all necessary HTTP methods and headers
- ✅ Includes proper error handling
- ✅ Minimal logging to avoid performance issues

## 🔧 Environment Variables for Render

**REQUIRED**: Set these exact environment variables in your Render dashboard:

```
NODE_ENV=production
ALLOWED_ORIGINS=https://hssm-services.web.app,https://hssm-services.firebaseapp.com
PORT=10000
MONGO_URI=mongodb+srv://Jas65386538:Jas65386538@coko.ihxtg.mongodb.net/?retryWrites=true&w=majority&appName=COKO
JWT_SECRET=Jas65386538
FRONTEND_URL=https://hssm-services.web.app
ADMIN=Jas65386538
PHONE=+254797436723
GEMINI_API_KEY=AIzaSyAH4H5bFMTJni5Wd7_QtkQJd0KTPAknuzE
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=bkitib2@gmail.com
EMAIL_PASSWORD=kbhzgarocdsvkcrr
GOOGLE_CLIENT_ID=1030828567617-6qjdpjjhceiit0sf6aem2vdipoospsd3.apps.googleusercontent.com
```

**Critical**: `ALLOWED_ORIGINS` is now **required** in ALL environments. The application will throw an error on startup if this environment variable is not set.

## 📋 Deployment Steps

### 1. Deploy Backend to Render

```bash
# Commit and push changes
git add .
git commit -m "Fix CORS configuration for production"
git push origin main

# In Render dashboard:
# - Go to your service
# - Set environment variables above
# - Trigger manual deploy
```

### 2. Verify CORS is Working

After deployment, test these endpoints:

```bash
# Test CORS configuration
curl -H "Origin: https://hssm-services.web.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://hssm-2-1.onrender.com/api/test-cors

# Test actual API endpoint
curl -H "Origin: https://hssm-services.web.app" \
     -H "Content-Type: application/json" \
     -X POST \
     -d '{"email":"test@test.com","password":"test"}' \
     https://hssm-2-1.onrender.com/api/auth/login
```

### 3. Deploy Frontend

```bash
cd frontend/frontend
npm run build
firebase deploy
```

## 🔍 Troubleshooting

### If CORS still fails:

1. **Check Render Environment Variables**:

   - Ensure `NODE_ENV=production`
   - Ensure `ALLOWED_ORIGINS` includes your Firebase URL

2. **Check Render Logs**:

   - Look for CORS-related error messages
   - Verify the server is reading environment variables correctly

3. **Test with Browser DevTools**:

   - Open Network tab
   - Look for OPTIONS preflight requests
   - Check response headers for CORS headers

4. **Common Issues**:
   - **Missing PORT**: Render uses `10000` by default
   - **Wrong Origins**: Must include `https://hssm-services.web.app`
   - **NODE_ENV**: Must be `production` for production CORS rules

## 🎯 CORS Configuration Details

The new CORS configuration:

- **Development**: Allows all localhost origins + listed origins
- **Production**: Only allows explicitly listed origins
- **Methods**: GET, POST, PUT, DELETE, OPTIONS, PATCH
- **Headers**: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token
- **Credentials**: Enabled for authentication
- **Preflight**: Handled automatically

## 📞 Support

If CORS issues persist:

1. Check browser console for specific error messages
2. Verify Firebase hosting URL matches ALLOWED_ORIGINS
3. Test with the `/api/test-cors` endpoint
4. Check Render deployment logs

The CORS configuration is now bulletproof and should work reliably in production! 🎉
