import * as http      from 'http';
import * as httpProxy from 'http-proxy';
import * as url       from 'url';
import * as process   from 'process';

// Get server port
const port: string       = process.argv[2];
// Get target URL
const targetUrl: string = process.argv[3];
// Get open knocking sequence
const openKnockingSeq: string[]  = process.argv[4].split(",");
// Get close knocking sequence
const closeKnockingSeq: string[] = process.argv[5] === undefined ? openKnockingSeq.slice().reverse() : process.argv[5].split(",");

// Create proxy instance
const proxy = httpProxy.createServer();

// Whether Server is available or not
let isOpen: boolean = false;
// Knocking index for open
let openKnockingIdx: number  = 0;
// Knocking index for close
let closeKnockingIdx: number = 0;

// HTTP Reverse Proxy Server
const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  // Get path name
  const pathName = url.parse(req.url).pathname;
  console.log(pathName);

  // If server is available
  if (isOpen) {
    if (pathName === closeKnockingSeq[closeKnockingIdx]) {
      // Proceed close knocking
      closeKnockingIdx++;    
      if (closeKnockingIdx === closeKnockingSeq.length) {
        // Close the server
        isOpen = false;
        // Reset close knocking sequence
        closeKnockingIdx = 0;
        res.write("Closed\n");
      }
      res.end();
    } else {
      // Use proxy
      proxy.web(req, res, {target: targetUrl});
    }
  } else if (pathName === openKnockingSeq[openKnockingIdx]) {
    // Proceed open knocking
    openKnockingIdx++;
    if(openKnockingIdx === openKnockingSeq.length) {
      // Open the server
      isOpen = true;
      // Reset open knocking sequend
      openKnockingIdx = 0;
      res.write("Open\n");
    }
    res.end();    
  } else {
     // Do nothing
    res.end();
  }
});

server.listen(port);
console.log(`Server is listening on ${port}...`);

