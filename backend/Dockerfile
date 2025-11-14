# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install dependencies for building
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM base AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S solsight -u 1001

WORKDIR /app

# Copy installed dependencies from deps stage
COPY --from=deps --chown=solsight:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=solsight:nodejs . .

# Set ownership to non-root user
USER solsight

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]