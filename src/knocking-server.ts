import * as httpProxy from "http-proxy";
import * as http from "http";
import * as url from "url";

/**
 * Run the knocking
 * @param {string | url.URL} targetUrl
 * @param {string[]} openKnockingSeq
 * @param {string[]} closeKnockingSeq
 * @param {number | undefined} autoCloseMillis
 * @param {boolean} quiet
 */
export function createKnockingServer(targetUrl: string | url.URL, openKnockingSeq: string[], closeKnockingSeq: string[], autoCloseMillis: number | undefined = undefined, quiet: boolean = false) {
  // Create proxy instance
  const proxy = httpProxy.createServer();

  // Whether Server is available or not
  let isOpen: boolean = false;
  // Knocking index for open
  let openKnockingIdx: number = 0;
  // Knocking index for close
  let closeKnockingIdx: number = 0;

  // Set open/close indexes
  function resetIdxs(){
    openKnockingIdx  = 0;
    closeKnockingIdx = 0;
  }

  // HTTP Reverse Proxy Server
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    // Get path name
    const pathName = url.parse(req.url).pathname
      // Remove last "/"
      .replace(/\/$/, "");
    if(!quiet) {
      // Print path name
      console.log(pathName);
    }

    // If server is available
    if (isOpen) {
      if (pathName === closeKnockingSeq[closeKnockingIdx]) {
        // Proceed close knocking
        closeKnockingIdx++;
        if (closeKnockingIdx === closeKnockingSeq.length) {
          // Close the server
          isOpen = false;
          // Set open/close indexes
          resetIdxs();
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
      if (openKnockingIdx === openKnockingSeq.length) {
        // Open the server
        isOpen = true;
        // Set open/close indexes
        resetIdxs();

        if(autoCloseMillis !== undefined) {
          // Close the server in autoCloseMillis
          setTimeout(() => {
            // Close
            isOpen = false;
            // Set open/close indexes
            resetIdxs();
          }, autoCloseMillis);
        }

        res.write("Open\n");
      }
      res.end();
    } else {
      // Do nothing
      res.end();
    }
  });

  return server;
}