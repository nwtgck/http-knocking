# http-knocking

[![NpmVersion](https://img.shields.io/npm/v/http-knocking.svg)](https://www.npmjs.com/package/http-knocking)
 [![Build Status](https://travis-ci.com/nwtgck/http-knocking.svg?branch=develop)](https://travis-ci.com/nwtgck/http-knocking) [![Docker Automated build](https://img.shields.io/docker/automated/nwtgck/http-knocking.svg)](https://hub.docker.com/r/nwtgck/http-knocking/) [![](https://images.microbadger.com/badges/image/nwtgck/http-knocking.svg)](https://microbadger.com/images/nwtgck/http-knocking "Get your own image badge on microbadger.com")

HTTP knocking is like port knocking. It hides your server, and allows you to open/close the server by certain knocking.   
In HTTPS communication, knocking is hidden because of encryption unlike port knocking.

![demo1](demo_images/demo1.gif)

## Run with npm

Suppose http://localhost:8181/ is running. The following command runs a http-knocking server on port 8282.

```bash
npm install -g http-knocking
http-knocking --port=8282 --target-url=http://localhost:8181 --open-knocking="/alpha,/foxtrot,/lima"
```

In the case of `--open-knocking="/alpha,/foxtrot,/lima"`, you can **open the server** by accessing to

1. <http://localhost:8282/alpha>
1. <http://localhost:8282/foxtrot>
1. <http://localhost:8282/lima>  

Close procedure is the reverse order of open if `--close-knocking` is not specfied.  
Technically, `localhost:8282` is a reverse proxy server to `localhost:8181`.


## Run with Docker Compose

Here is a `docker-compose.yml` to run [Ghost](https://ghost.org/) on http-knocking.

```yaml
version: '3.1'
services:
  http-knocking:
    image: nwtgck/http-knocking:v0.2.0
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

## Options

Here is available options.

```
Options:
  --help                               Show help                       [boolean]
  --version                            Show version number             [boolean]
  --port                               Port of knocking server        [required]
  --target-url                         Target URL to hide             [required]
  --open-knocking                      Open-knocking sequence (e.g.
                                       "/alpha,/foxtrot,/lima")       [required]
  --close-knocking                     Close-knocking sequence (e.g.
                                       "/victor,/kilo")
  --auto-close-millis                  Time millis to close automatically
  --open-knocking-max-interval-millis  Time millis to reset open procedure
```

 `--auto-close-millis` option makes your server more secure because it closes automatically by time.  
 `--open-knocking-max-interval-millis` option also makes your server more secure because it reset open procedure by time.