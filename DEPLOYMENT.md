# Docketra Deployment Guide

This document provides comprehensive instructions for deploying the Docketra web application to production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Production Testing](#local-production-testing)
- [Render Deployment](#render-deployment)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying Docketra, ensure you have the following:

### Required Software
- **Node.js**: Version 18.x or higher (recommended: 20.x LTS)
- **npm**: Version 9.x or higher
- **MongoDB**: Version 6.0 or higher (MongoDB Atlas recommended for production)

### Required Accounts
- **MongoDB Atlas**: For production database hosting
  - Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas)
  - Set up a cluster and obtain a connection string
- **Render** (or similar hosting platform): For application hosting
  - Create an account at [render.com](https://render.com)

### Required Information
- MongoDB connection string (MONGODB_URI)
- Strong JWT secret key (JWT_SECRET) - at least 32 characters
- Production domain/URL for CORS configuration

---

## Environment Variables

Docketra requires the following environment variables for production deployment:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (auto-set by Render) | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/docketra` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secure-random-string-min-32-chars` |
| `FRONTEND_URL` | Production frontend URL for CORS | `https://docketra.onrender.com` |

### Setting Up Environment Variables

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your values**:
   ```bash
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=your_actual_mongodb_connection_string
   JWT_SECRET=your_actual_jwt_secret_key
   FRONTEND_URL=https://your-production-domain.com
   ```

3. **Generate a secure JWT secret**:
   ```bash
   # Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Or using OpenSSL
   openssl rand -hex 32
   ```

### MongoDB Connection String Setup

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to your cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with your database name (e.g., `docketra`)

Example:
```
mongodb+srv://dbuser:mySecurePassword123@cluster0.xxxxx.mongodb.net/docketra?retryWrites=true&w=majority
```

---

## Local Production Testing

Test the production build locally before deploying to ensure everything works correctly.

### Step 1: Install Dependencies

```bash
# Install backend dependencies
npm install

# Install UI dependencies
npm run install:ui
```

### Step 2: Build the UI

```bash
# Build the React UI for production
npm run build:ui
```

This command will:
- Navigate to the `ui/` directory
- Run `npm run build` (Vite build)
- Create optimized production files in `ui/dist/`

### Step 3: Set Environment Variables

```bash
# Export environment variables (Linux/Mac)
export NODE_ENV=production
export MONGODB_URI="your-mongodb-connection-string"
export JWT_SECRET="your-jwt-secret"
export PORT=5000
export FRONTEND_URL="http://localhost:5000"

# For Windows PowerShell
$env:NODE_ENV="production"
$env:MONGODB_URI="your-mongodb-connection-string"
$env:JWT_SECRET="your-jwt-secret"
$env:PORT="5000"
$env:FRONTEND_URL="http://localhost:5000"
```

Alternatively, use a `.env` file (recommended):
```bash
# Create .env file with production values
echo "NODE_ENV=production" > .env
echo "MONGODB_URI=your-mongodb-connection-string" >> .env
echo "JWT_SECRET=your-jwt-secret" >> .env
echo "PORT=5000" >> .env
echo "FRONTEND_URL=http://localhost:5000" >> .env
```

### Step 4: Start the Production Server

```bash
npm start
```

### Step 5: Test Locally

1. Open your browser to `http://localhost:5000`
2. Test the login functionality
3. Navigate through different pages
4. Check browser console for errors
5. Test admin features (if applicable)

---

## Render Deployment

Render provides a simple deployment process with GitHub integration.

### Step 1: Prepare Your Repository

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. **Ensure sensitive files are gitignored**:
   - Verify `.env` is in `.gitignore`
   - Confirm no secrets are committed

### Step 2: Create a New Web Service on Render

1. **Log in to Render**: Visit [render.com](https://render.com) and sign in
2. **Create New Web Service**: Click "New +" → "Web Service"
3. **Connect Repository**:
   - Click "Connect a repository"
   - Authorize GitHub access if prompted
   - Select your Docketra repository

### Step 3: Configure the Web Service

Fill in the following settings:

| Setting | Value |
|---------|-------|
| **Name** | `docketra` (or your preferred name) |
| **Region** | Select closest to your users |
| **Branch** | `main` |
| **Root Directory** | (leave empty) |
| **Environment** | `Node` |
| **Build Command** | `npm install && npm run build:ui` |
| **Start Command** | `npm start` |
| **Plan** | Free (or paid based on needs) |

### Step 4: Add Environment Variables

In the Render dashboard for your service:

1. Scroll to the "Environment Variables" section
2. Click "Add Environment Variable"
3. Add each variable:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `your-mongodb-atlas-connection-string` |
   | `JWT_SECRET` | `your-secure-jwt-secret` |
   | `FRONTEND_URL` | (leave empty initially, update after deployment) |

4. Click "Create Web Service"

### Step 5: Update FRONTEND_URL

After your service is deployed:

1. Copy your Render service URL (e.g., `https://docketra.onrender.com`)
2. Go back to "Environment Variables"
3. Update or add `FRONTEND_URL` with your service URL
4. Click "Save Changes" (this will trigger a redeploy)

### Step 6: Auto-Deploy Setup

Render automatically deploys when you push to the connected branch:

1. Go to your service settings
2. Under "Build & Deploy", confirm:
   - Auto-Deploy: **Yes**
   - Branch: `main`
3. Every push to `main` will trigger a new deployment

### Deployment Timeline

- **Build Time**: 3-5 minutes (first deploy may take longer)
- **Cold Start**: 30-60 seconds (on free tier)
- **Subsequent Requests**: < 1 second

---

## Verification Checklist

After deployment, verify the following:

### Functional Testing
- [ ] **Application Loads**: Visit production URL and confirm Docketra loads
- [ ] **Login Works**: Test login with valid credentials
- [ ] **JWT Authentication**: Verify tokens are issued and validated
- [ ] **Protected Routes**: Confirm authentication-required pages work
- [ ] **Admin Reports**: Test reports page (admin role only)
- [ ] **CRUD Operations**: Test creating, reading, updating, deleting records
- [ ] **SPA Routing**: Refresh browser on different routes (should not 404)

### Browser Console Checks
- [ ] **No CORS Errors**: Open DevTools → Console, check for CORS issues
- [ ] **No 404s**: Verify all assets load correctly
- [ ] **No JavaScript Errors**: Check for runtime errors
- [ ] **API Calls Work**: Confirm API requests succeed

### Security Verification
- [ ] **No Secrets Exposed**: Check Network tab, ensure no secrets in responses
- [ ] **Error Messages Generic**: Test invalid requests, confirm no stack traces
- [ ] **HTTPS Enabled**: Verify SSL certificate is active
- [ ] **Security Headers**: Check response headers include helmet protections

### Performance Checks
- [ ] **Load Time**: Application loads in < 3 seconds
- [ ] **API Response Time**: API calls respond in < 1 second
- [ ] **Asset Optimization**: JS/CSS files are minified

### Environment Variables
- [ ] **All Variables Set**: Confirm all required env vars in Render dashboard
- [ ] **Correct Values**: Double-check MongoDB URI, JWT secret
- [ ] **FRONTEND_URL**: Matches actual deployment URL

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Application Won't Start

**Symptoms**: Service shows "Deploying" indefinitely or crashes immediately

**Solutions**:
- Check Render logs for error messages
- Verify all required environment variables are set
- Confirm MongoDB connection string is correct
- Test MongoDB connection from your IP

**How to Check Logs**:
```
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. Look for error messages in red
```

#### 2. "Missing required environment variables" Error

**Symptoms**: Server exits with error about missing MONGODB_URI or JWT_SECRET

**Solutions**:
- Add missing variables in Render dashboard
- Click "Manual Deploy" → "Clear build cache & deploy"
- Verify variable names are exact (case-sensitive)

#### 3. CORS Errors in Browser

**Symptoms**: Console shows "Access-Control-Allow-Origin" errors

**Solutions**:
- Ensure `FRONTEND_URL` is set to your Render URL
- Confirm `FRONTEND_URL` does NOT have trailing slash
- Check that origin matches exactly (https vs http)

**Example Fix**:
```
# Correct
FRONTEND_URL=https://docketra.onrender.com

# Incorrect
FRONTEND_URL=https://docketra.onrender.com/
FRONTEND_URL=http://docketra.onrender.com  (wrong protocol)
```

#### 4. 404 on Page Refresh (SPA Routing Issue)

**Symptoms**: Refreshing on `/dashboard` or `/reports` returns 404

**Solutions**:
- Verify `ui/dist` folder exists after build
- Check server.js has SPA fallback route
- Confirm build command includes `npm run build:ui`

**Verify Build Output**:
```bash
# Locally test
npm run build:ui
ls -la ui/dist/  # Should show index.html and assets
```

#### 5. Database Connection Failed

**Symptoms**: "MongoNetworkError" or "connection refused"

**Solutions**:
- Whitelist Render IPs in MongoDB Atlas (or allow from anywhere: `0.0.0.0/0`)
- Check MongoDB Atlas → Network Access
- Verify database user credentials are correct
- Ensure connection string format is correct

**MongoDB Atlas Network Access**:
```
1. Go to MongoDB Atlas dashboard
2. Click "Network Access" in sidebar
3. Click "Add IP Address"
4. Select "Allow Access from Anywhere" (0.0.0.0/0)
5. Click "Confirm"
```

#### 6. Build Fails on Render

**Symptoms**: Build command exits with error

**Solutions**:
- Check if `ui/package.json` exists
- Verify Node.js version compatibility
- Review build logs for specific error
- Try building locally first

**Local Build Test**:
```bash
npm install
npm run install:ui
npm run build:ui
# If this fails, fix locally first
```

#### 7. Environment Variables Not Working

**Symptoms**: Application uses default values instead of env vars

**Solutions**:
- Confirm variables are saved in Render (not just added)
- Click "Manual Deploy" after adding variables
- Check for typos in variable names
- Verify `.env` is not committed (should be in `.gitignore`)

#### 8. Slow Cold Starts (Free Tier)

**Symptoms**: First request takes 30-60 seconds

**Solutions**:
- This is normal on Render's free tier
- Consider upgrading to paid tier for always-on service
- Use external monitoring to keep service warm

**Keep-Alive Solution** (optional):
```bash
# Use a service like UptimeRobot to ping your app every 5 minutes
# Endpoint to ping: https://your-app.onrender.com/health
```

---

## Additional Resources

### Documentation Links
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Vite Production Build](https://vitejs.dev/guide/build.html)

### Monitoring and Logs
- **Render Logs**: Dashboard → Service → Logs tab
- **MongoDB Logs**: Atlas → Database → Metrics tab
- **Browser DevTools**: F12 → Console/Network tabs

### Support
- **GitHub Issues**: Report bugs in the repository
- **Render Support**: support@render.com
- **MongoDB Support**: support.mongodb.com

---

## Security Best Practices

### Before Deploying
1. Never commit `.env` files
2. Use strong, unique JWT_SECRET (32+ characters)
3. Enable MongoDB network access controls
4. Review code for hardcoded secrets
5. Keep dependencies updated

### After Deploying
1. Monitor application logs regularly
2. Set up error tracking (e.g., Sentry)
3. Enable MongoDB backup
4. Implement rate limiting if needed
5. Regular security audits

### Rotating Secrets
If you need to rotate JWT_SECRET:
1. Update `JWT_SECRET` in Render
2. All users will need to log in again
3. Previous tokens will be invalidated

---

## Performance Optimization

### Production Optimizations Already Applied
- ✅ Vite build minification and bundling
- ✅ Express static file serving with compression
- ✅ Helmet security headers
- ✅ CORS configured for specific origin
- ✅ Environment-based configuration

### Additional Optimizations (Optional)
- Add Redis caching for frequently accessed data
- Implement CDN for static assets
- Enable database indexes on frequently queried fields
- Add response compression middleware
- Implement rate limiting for API endpoints

---

## Maintenance

### Regular Tasks
- **Weekly**: Check application logs for errors
- **Monthly**: Update dependencies (`npm update`)
- **Quarterly**: Security audit and dependency vulnerability scan
- **As Needed**: Database backup verification

### Updating the Application
```bash
# Make changes locally
git add .
git commit -m "Description of changes"
git push origin main

# Render will automatically deploy
# Monitor deployment in Render dashboard
```

---

## Rollback Procedure

If a deployment causes issues:

1. **In Render Dashboard**:
   - Go to your service
   - Click "Manual Deploy"
   - Select "Deploy previous commit"
   - Choose the last working commit

2. **In Git**:
   ```bash
   git revert HEAD
   git push origin main
   # Or reset to previous commit
   git reset --hard HEAD^
   git push --force origin main
   ```

---

## Contact and Support

For deployment issues or questions:
- Open an issue in the GitHub repository
- Contact the development team
- Check the troubleshooting section above

---

**Last Updated**: January 2026
**Version**: 1.0.0
