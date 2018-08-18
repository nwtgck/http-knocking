# http-knocking
[![Build Status](https://travis-ci.com/nwtgck/http-knocking.svg?branch=develop)](https://travis-ci.com/nwtgck/http-knocking) [![Docker Automated build](https://img.shields.io/docker/automated/nwtgck/http-knocking.svg)](https://hub.docker.com/r/nwtgck/http-knocking/) [![](https://images.microbadger.com/badges/image/nwtgck/http-knocking.svg)](https://microbadger.com/images/nwtgck/http-knocking "Get your own image badge on microbadger.com")

HTTP knocking like port knocking

![demo1](demo_images/demo1.gif)

## Run with npm

Suppose http://localhost:8181/ is running. The following command runs a http-knocking server on port 8282.

```bash
cd <this repo>
npm install
npm start -- --port=8282 --target-url=http://localhost:8181 --open-knocking="/alpha,/foxtrot,/lima"
```

## Run with Docker Compose

Here is a `docker-compose.yml` to run [Ghost](https://ghost.org/) on http-knocking.

```yaml
version: '3.1'
services:
  http-knocking:
    image: nwtgck/http-knocking:v0.1.0
    ports:
      - '8282:8282'
    depends_on:
      - ghost
    restart: always
    command: --port=8282 --target-url=http://ghost:2368 --open-knocking="/alpha,/foxtrot,/lima"
  ghost:
    image: ghost
    restart: always
    expose:
      - "2368"
```
