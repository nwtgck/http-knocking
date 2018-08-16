const http      = require('http');
const httpProxy = require('http-proxy');
const url       = require('url');
const process   = require('process');

// Get server port
const port       = process.argv[2];
// Get target URL
const targetUrl = process.argv[3];

// Create proxy instance
const proxy = httpProxy.createServer();

// HTTP Reverse Proxy Server
const server = http.createServer((req, res) => {
  // Get path name
  const pathName = url.parse(req.url).pathname;
  console.log(pathName);
  // Use proxy
  proxy.web(req, res, {target: targetUrl});
});

server.listen(port);
console.log(`Server is listening on ${port}...`)
