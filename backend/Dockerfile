# Dockerfile for Voice Assistant Backend
FROM node:18-bullseye-slim

# Install dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create audio and data directories
RUN mkdir -p audio data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5001
ENV HOST=0.0.0.0

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 5001, path: '/api/health', timeout: 2000 }; const req = http.request(options, (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1) }); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["npm", "start"]