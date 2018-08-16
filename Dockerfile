FROM node:8.11.3

LABEL maintainer="Ryo Ota <nwtgck@gmail.com>"

COPY . /app

# Move to /app
WORKDIR /app

# Install requirements
RUN npm install

# Run entry (Run the server)
ENTRYPOINT ["node", "main.js"]
