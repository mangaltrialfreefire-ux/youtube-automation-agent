FROM node:20-bookworm-slim

# Install system dependencies including ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application source
COPY . .

# Environment setup
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run YouTube Automation Agent
CMD ["npm", "start"]
