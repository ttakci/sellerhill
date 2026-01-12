# Environment Configuration Guide

This document explains how to set up environment variables for the template.

## Setup Instructions

1. **Web Application** (`apps/web/`)
   ```bash
   cd apps/web
   cp .env.example .env
   ```
2. **API Application** (`apps/api/`)

   ```bash
   cd apps/api
   cp .env.example .env
   ```

3. Edit the `.env` files with your actual values

## Environment Files

- `.env.example` - Template file (committed to git)
- `.env` - Actual values (ignored by git)
- `.env.local` - Local overrides (ignored by git)
- `.env.production` - Production values (ignored by git)

## Web App Variables

| Variable                | Description           | Default                 | Required |
| ----------------------- | --------------------- | ----------------------- | -------- |
| `VITE_API_URL`          | Backend API URL       | `http://localhost:3000` | ✅       |
| `VITE_APP_NAME`         | Application name      | `React NestJS Template` | ✅       |
| `VITE_ENABLE_AUTH`      | Enable authentication | `false`                 | ❌       |
| `VITE_ENABLE_ANALYTICS` | Enable analytics      | `false`                 | ❌       |

## API Variables

| Variable        | Description    | Default       | Required               |
| --------------- | -------------- | ------------- | ---------------------- |
| `NODE_ENV`      | Environment    | `development` | ✅                     |
| `PORT`          | Server port    | `3000`        | ✅                     |
| `DATABASE_HOST` | Database host  | `localhost`   | ✅                     |
| `DATABASE_NAME` | Database name  | `template_db` | ✅                     |
| `JWT_SECRET`    | JWT secret key | -             | ⚠️ (when auth enabled) |

## Security Notes

⚠️ **Never commit `.env` files to git!**

- Always use `.env.example` as template
- Change default secrets in production
- Use strong random values for JWT secrets
- Enable SSL in production

## Feature Flags

Feature flags allow enabling/disabling features without code changes:

- `VITE_ENABLE_AUTH` - Authentication module
- `VITE_ENABLE_ANALYTICS` - Analytics tracking
- `VITE_ENABLE_DEV_TOOLS` - Redux DevTools

## Production Checklist

- [ ] Change all default secrets
- [ ] Set `NODE_ENV=production`
- [ ] Enable `DATABASE_SSL=true`
- [ ] Configure CORS origins
- [ ] Set up monitoring (Sentry)
- [ ] Enable rate limiting
- [ ] Configure email service
- [ ] Set up CDN for static files
