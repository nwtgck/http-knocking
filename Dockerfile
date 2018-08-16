FROM node:8.11.3

LABEL maintainer="Ryo Ota <nwtgck@gmail.com>"

COPY . /app

# Move to /app
WORKDIR /app

# Install requirements and build
RUN npm install && npm run build

# Run entry (Run the server)
ENTRYPOINT ["node", "dist/main.js"]
