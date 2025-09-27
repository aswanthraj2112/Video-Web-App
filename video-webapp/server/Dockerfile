# Stage 1 – install production dependencies with a full build image
FROM node:18-bullseye AS builder
WORKDIR /app

# Install dependencies first to maximise layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code into the build context
COPY . .

# Stage 2 – minimal runtime image with ffmpeg available
FROM node:18-slim
WORKDIR /app

# Copy the application code and node_modules from the builder stage
COPY --from=builder /app .

# Install ffmpeg and curl for video processing and health checks
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl \
  && rm -rf /var/lib/apt/lists/*

# Allow the runtime port to be overridden when the container starts
ARG PORT=4000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Report container health to ECS/EC2 orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Start the API server
CMD ["node", "src/index.js"]
