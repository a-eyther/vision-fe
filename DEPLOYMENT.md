# Deployment Guide

This guide will help you deploy both the frontend and backend applications.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud-hosted)
- A hosting platform account (Railway, Render, Heroku, AWS, etc.)

## Environment Variables Setup

### Backend Environment Variables:
```bash
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production
PORT=5001
```

### Frontend Environment Variables:
```bash
VITE_API_URL=https://your-backend-domain.com
```

## Database Setup

1. **Create a PostgreSQL database** using one of these options:
   - **Supabase** (Free tier available):
     - Create account at supabase.com
     - Create a new project
     - Use the connection string from Settings → Database
   
   - **Railway** (Free tier available):
     - Create account at railway.app
     - Create a new Postgres database
     - Use the provided connection string
   
   - **AWS RDS** (Production-ready):
     - Create a PostgreSQL instance
     - Configure security groups for access
     - Use the endpoint as connection string

2. **Run the database setup script:**
   ```bash
   psql DATABASE_URL < backend/database-setup.sql
   ```

## Deployment Options

### Option 1: Railway (Recommended for simplicity)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Deploy Backend:**
   ```bash
   cd backend
   railway login
   railway init
   railway add
   railway deploy
   ```

3. **Deploy Frontend:**
   ```bash
   cd ../frontend
   railway init
   railway add
   railway deploy
   ```

### Option 2: Docker Deployment

1. **Create Dockerfiles** for both frontend and backend (see examples below)

2. **Build and push images:**
   ```bash
   docker build -t project-theia-backend ./backend
   docker build -t project-theia-frontend ./frontend
   ```

3. **Deploy to your preferred container service** (ECS, Google Cloud Run, etc.)

### Option 3: Traditional VPS Deployment

1. **Set up a VPS** (DigitalOcean, Linode, AWS EC2)

2. **Install dependencies:**
   ```bash
   sudo apt update
   sudo apt install nodejs npm postgresql nginx
   ```

3. **Clone and setup:**
   ```bash
   git clone <your-repo>
   cd Project_Theia_Cleaned
   
   # Setup backend
   cd backend
   npm install
   npm run build
   
   # Setup frontend
   cd ../frontend
   npm install
   npm run build
   ```

4. **Configure Nginx** as reverse proxy

5. **Use PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name backend
   pm2 save
   pm2 startup
   ```

## Example Dockerfile for Backend

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5001
CMD ["node", "server.js"]
```

## Example Dockerfile for Frontend

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Post-Deployment Checklist

1. **Test API endpoints:**
   - Health check: `https://your-backend-domain.com/health`
   - Auth endpoints: `https://your-backend-domain.com/api/auth`

2. **Test frontend functionality:**
   - File upload
   - Dashboard visualization
   - User authentication

3. **Set up monitoring:**
   - Application logs
   - Error tracking (Sentry, LogRocket)
   - Performance monitoring

4. **Configure backups:**
   - Database backups
   - Application state backups

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly in backend environment variables
- Check that the frontend URL is included in the CORS origins

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Ensure the database is accessible from your deployment
- Check firewall rules and security groups

### Build Failures
- Check that all dependencies are in `package.json`
- Ensure build scripts are correct
- Review application logs for specific errors

## Security Considerations

1. **Use HTTPS** for all deployments
2. **Set secure headers** (already configured with Helmet)
3. **Rotate JWT secrets** regularly
4. **Keep dependencies updated**
5. **Configure rate limiting** (already included)
6. **Set up proper firewall rules**

## Scaling Considerations

1. **Database:**
   - Use connection pooling
   - Consider read replicas for scaling
   - Implement caching (Redis)

2. **Backend:**
   - Use load balancer for multiple instances
   - Implement horizontal scaling
   - Consider microservices architecture

3. **Frontend:**
   - Use CDN for static assets
   - Implement lazy loading
   - Optimize bundle size