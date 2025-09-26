FROM node:18-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
EXPOSE 4000
CMD ["node", "src/index.js"]
