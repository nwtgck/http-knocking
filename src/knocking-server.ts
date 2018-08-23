import * as httpProxy from "http-proxy";
import * as http from "http";
import * as url from "url";
import * as net from "net";

/**
 * Run the knocking
 * @param {string} targetHost
 * @param {number} targetPort
 * @param {string[]} openKnockingSeq
 * @param {string[]} closeKnockingSeq
 * @param {boolean} enableWebSocket
 * @param {number | undefined} autoCloseMillis
 * @param {number | undefined} openKnockingMaxIntervalMillis
 * @param {boolean} quiet
 */
export function createKnockingServer(targetHost: string, targetPort: number, openKnockingSeq: string[], closeKnockingSeq: string[], enableWebSocket: boolean = false, autoCloseMillis: number | undefined = undefined, openKnockingMaxIntervalMillis: number | undefined = undefined, quiet: boolean = false) {
  // Create proxy instance
  const proxy = httpProxy.createServer(
    enableWebSocket ? {
      "target": `ws://${targetHost}:${targetPort}`,
      "ws": true
    } : {}
  );

  // Whether Server is available or not
  let isOpen: boolean = false;
  // Knocking index for open
  let openKnockingIdx: number = 0;
  // Knocking index for close
  let closeKnockingIdx: number = 0;
  // timeout ID for openKnockingMaxIntervalMillis
  let timerId: NodeJS.Timer | undefined = undefined;

  // Set open/close indexes
  function resetIdxs(){
    openKnockingIdx  = 0;
    closeKnockingIdx = 0;
  }

  // Close by millis if millis are defined
  function closeByMillisIfDefined(millis: number | undefined): NodeJS.Timer | undefined {
    // Cancel auto-close-by-time if a timer is defined
    cancelAutoCloseByTimeIfDefined();

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

  // Cancel auto-close-by-time if a timer is defined
  function cancelAutoCloseByTimeIfDefined() {
    if(timerId !== undefined) {
      // Cancel timeout for openKnockingMaxInterval
      clearTimeout(timerId);
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
          // Cancel auto-close-by-time if a timer is defined
          cancelAutoCloseByTimeIfDefined();
          // Close the server
          isOpen = false;
          // Set open/close indexes
          resetIdxs();
          res.write("Closed\n");
        }
        res.end();
      } else {
        // Use proxy
        proxy.web(req, res, {target: `http://${targetHost}:${targetPort}`});
      }
    } else if (pathName === openKnockingSeq[openKnockingIdx]) {
      // Cancel auto-close-by-time if a timer is defined
      cancelAutoCloseByTimeIfDefined();
      // Proceed open knocking
      openKnockingIdx++;
      if (openKnockingIdx === openKnockingSeq.length) {
        // // Clear timerId
        // timerId = undefined;
        // Open the server
        isOpen = true;
        // Set open/close indexes
        resetIdxs();
        // Close by closeByMillisIfDefined if it is defined
        timerId = closeByMillisIfDefined(autoCloseMillis);

        res.write("Open\n");
      } else {
        // Close by openKnockingMaxIntervalMillis if it is defined
        timerId = closeByMillisIfDefined(openKnockingMaxIntervalMillis);
      }
      res.end();
    } else {
      // Do nothing
      res.end();
    }
  });


  if(enableWebSocket) {
    // WebSocket server proxy
    server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: any) => {
      if (isOpen) {
        proxy.ws(req, socket, head);
      } else {
        // Close this connection
        socket.destroy();
      }
    });
  }

  return server;
}