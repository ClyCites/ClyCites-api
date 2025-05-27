FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p uploads/profiles uploads/documents logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S clycites -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R clycites:nodejs /app && \
    chmod -R 755 /app/uploads && \
    chmod -R 755 /app/logs

# Switch to non-root user
USER clycites

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { \
    let data = ''; \
    res.on('data', chunk => data += chunk); \
    res.on('end', () => { \
      try { \
        const health = JSON.parse(data); \
        process.exit(health.status === 'success' ? 0 : 1); \
      } catch(e) { \
        process.exit(1); \
      } \
    }); \
  }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
