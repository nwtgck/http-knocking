import * as httpProxy from "http-proxy";
import * as http from "http";
import * as url from "url";

/**
 * Run the knocking
 * @param {string | url.URL} targetUrl
 * @param {string[]} openKnockingSeq
 * @param {string[]} closeKnockingSeq
 * @param {number | undefined} autoCloseMillis
 * @param {number | undefined} openKnockingMaxIntervalMillis
 * @param {boolean} quiet
 */
export function createKnockingServer(targetUrl: string | url.URL, openKnockingSeq: string[], closeKnockingSeq: string[], autoCloseMillis: number | undefined = undefined, openKnockingMaxIntervalMillis: number | undefined = undefined, quiet: boolean = false) {
  // Create proxy instance
  const proxy = httpProxy.createServer();

  // Whether Server is available or not
  let isOpen: boolean = false;
  // Knocking index for open
  let openKnockingIdx: number = 0;
  // Knocking index for close
  let closeKnockingIdx: number = 0;
  // timeout ID for openKnockingMaxIntervalMillis
  let openKnockingMaxIntervalTimeoutId: NodeJS.Timer | undefined = undefined;

  // Set open/close indexes
  function resetIdxs(){
    openKnockingIdx  = 0;
    closeKnockingIdx = 0;
  }

  // Close by millis if millis are defined
  function closeByMillisIfDefined(millis: number | undefined): NodeJS.Timer | undefined {
    if(millis === undefined) {
      return undefined;
    } else {
      // Close the server in millis
      return setTimeout(() => {
        // Close
        isOpen = false;
        // Set open/close indexes
        resetIdxs();
      }, millis);
    }
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
      if(openKnockingMaxIntervalTimeoutId !== undefined) {
        // Cancel timeout for openKnockingMaxInterval
        clearTimeout(openKnockingMaxIntervalTimeoutId);
      }
      // Proceed open knocking
      openKnockingIdx++;
      if (openKnockingIdx === openKnockingSeq.length) {
        // Clear openKnockingMaxIntervalTimeoutId
        openKnockingMaxIntervalTimeoutId = undefined;
        // Open the server
        isOpen = true;
        // Set open/close indexes
        resetIdxs();
        // Close by closeByMillisIfDefined if it is defined
        closeByMillisIfDefined(autoCloseMillis);

        res.write("Open\n");
      } else {
        // Close by openKnockingMaxIntervalMillis if it is defined
        openKnockingMaxIntervalTimeoutId = closeByMillisIfDefined(openKnockingMaxIntervalMillis);
      }
      res.end();
    } else {
      // Do nothing
      res.end();
    }
  });

  return server;
}