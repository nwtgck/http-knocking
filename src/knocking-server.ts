import * as httpProxy from "http-proxy";
import * as http from "http";
import * as url from "url";
import * as net from "net";
import * as rp from "request-promise";
import * as fakelish from "fakelish";
import * as jsonTemplates from "json-templates";

import * as fakeResGenerator from "./fake-response-generator";

/**
 * Type which has optional property
 */
type OptionalProperty<T> = {
  [K in keyof T]: T[K] | undefined;
};

// Type of fake page
export type PageType = FakeNginx500PageType | EmptyResponsePageType;

interface FakeNginx500PageType {
  kind: "FakeNginx500PageType",
  nginxVersion: string
}

interface EmptyResponsePageType {
  kind: "EmptyResponsePageType"
}


/**
 * Type of notification callback
 */
type NotificationCallback = (openKnockingSeq: string[], closeKnockingSeq: string[]) => Promise<void>;

/**
 * Setting of auto knocking-update
 */
export interface KnockingUpdateSetting {
  intervalMillis: number;
  minLength: number;
  maxLength: number;
  nKnockings: number;
  notificationCallback: NotificationCallback;
}

/**
 * Single timer which ensure that only timer is active
 */
class SingleTimer {
  private timerId: NodeJS.Timer | undefined = undefined;

  constructor() {}

  /**
   * Cancel previous timer and set new one
   * @param f
   * @param millis
   */
  timeout(f: () => void, millis: number | undefined): void {
    // Cancel the previous timer
    this.cancel();

    if (millis !== undefined) {
      // Set new timer
      this.timerId = setTimeout(f, millis);
    }
  }

  /**
   * Cancel current timer set
   */
  cancel(): void {
    if (this.timerId !== undefined) {
      // Cancel the timer
      clearTimeout(this.timerId)
    }
  }
}

/**
 * Optional property
 * @param obj
 */
function opt<T>(obj: T | null | undefined): OptionalProperty<T> {
  return obj || ({} as OptionalProperty<T>);
}

/**
 * Mapping for optional
 * @param f
 * @param obj
 */
function optMap<T, S>(f: (p: T) => S, obj: T | null | undefined): OptionalProperty<S> {
  if (obj === null || obj === undefined) {
    return {} as OptionalProperty<S>;
  } else {
    return f(obj);
  }
}

/**
 * Create webhook notification
 * @param webhookUrl
 * @param template
 */
export function genereateWebhookNotificationCallback(webhookUrl: string, template: jsonTemplates.Template): NotificationCallback {
  return async (openKnockingSeq: string[], closeKnockingSeq: string[]): Promise<void> => {
    // Create JSON string by template
    const jsonStr: string = template({
      openKnocking: openKnockingSeq.join(","),
      closeKnocking: closeKnockingSeq.join(",")
    });
    await rp({
      url: webhookUrl,
      method: "POST",
      form: jsonStr,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr)
      }
    });
  };
}

/**
 * Run the knocking
 * @param {string} targetHost
 * @param {number} targetPort
 * @param {string[]} openKnockingSeq
 * @param {string[]} closeKnockingSeq
 * @param {boolean} enableWebSocket
 * @param {number | undefined} autoCloseMillis
 * @param {number | undefined} openKnockingMaxIntervalMillis
 * @param {number | undefined} httpRequestLimit
 * @param {number | undefined} onUpgradeLimit
 * @param {PageType | undefined} pageType
 * @param {KnockingUpdateSetting | undefined} knockingUpdateSetting
 * @param {boolean} quiet
 */
export function createKnockingServer(targetHost: string,
                                     targetPort: number,
                                     openKnockingSeq: string[],
                                     closeKnockingSeq: string[],
                                     enableWebSocket: boolean = false,
                                     autoCloseMillis: number | undefined = undefined,
                                     openKnockingMaxIntervalMillis: number | undefined = undefined,
                                     httpRequestLimit: number | undefined = undefined,
                                     onUpgradeLimit: number | undefined = undefined,
                                     pageType: PageType | undefined = undefined,
                                     knockingUpdateSetting: KnockingUpdateSetting | undefined = undefined,
                                     quiet: boolean = false) {

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
  // Timer of autoCloseMillis
  let autoCloseTimer: SingleTimer = new SingleTimer();
  // Timer of openKnockingMaxIntervalMillis
  let openKnockingMaxIntervalTimer: SingleTimer = new SingleTimer();
  // Timer of auto knocking-update
  let autoKnockingUpdateTimer: NodeJS.Timer | undefined;
  // Current HTTP request limit
  let currHttpRequestLimit: number | undefined;
  // Current on-upgrade limit
  let currOnUpgradeLimit: number | undefined;

  // Set open/close indexes
  function resetIdxs(){
    openKnockingIdx  = 0;
    closeKnockingIdx = 0;
  }

  // Close server
  function closeServer(): void {
    // Close
    isOpen = false;
    // Set open/close indexes
    resetIdxs();
  }

  // Set timer
  function setCloseTimerIfDefined(timer: SingleTimer, millis: number | undefined): void {
    timer.timeout(closeServer, millis);
  }

  // Update knocking process
  async function updateKnocking(): Promise<void> {
    // If knocking-update is enable
    if (knockingUpdateSetting !== undefined) {
      // Create new open-knocking sequence
      // NOTE: newOpenKnockingSeq will be pushed
      const newOpenKnockingSeq: string[] = [];
      for(let i = 0; i < knockingUpdateSetting.nKnockings; i++) {
        // Generate a fake word
        const fakeWord: string = await fakelish.generateFakeWord(
          knockingUpdateSetting.minLength,
          knockingUpdateSetting.maxLength
        );
        // Define open-path
        const openPath: string = "/" + fakeWord;
        // Push new open-knocking
        newOpenKnockingSeq.push(openPath);
      }
      // Create close-knocking sequence
      const newCloseKnockingSeq: string[] =
        newOpenKnockingSeq.slice().reverse();

      // Reset open/close indexes
      resetIdxs();
      // Update new sequences
      openKnockingSeq  = newOpenKnockingSeq;
      closeKnockingSeq = newCloseKnockingSeq;

      // Call notification-callback
      knockingUpdateSetting.notificationCallback(
        openKnockingSeq,
        closeKnockingSeq
      );

      // Next loop
      autoKnockingUpdateTimer = setTimeout(updateKnocking, knockingUpdateSetting.intervalMillis);
    }
  }
  // If knocking-update is enable
  if (knockingUpdateSetting !== undefined) {
    // Start update knocking
    updateKnocking()
      .catch(reason => {
        console.error(reason);
      });
  }


  // HTTP Reverse Proxy Server
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    // Get path name
    const pathName =
      opt(optMap(url.parse, opt(req.url)).pathname)
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
          // Cancel auto-close timer
          autoCloseTimer.cancel();
          // Close the server
          isOpen = false;
          // Set open/close indexes
          resetIdxs();
          res.write("Closed\n");
        }
        res.end();
      } else {
        if (currHttpRequestLimit !== undefined ) {
          // Decrement limit of HTTP request
          currHttpRequestLimit--;
          // If server reached HTTP request limit
          if(currHttpRequestLimit <= 0) {
            // Close server
            closeServer();
          }
        }
        // Use proxy
        proxy.web(req, res, {target: `http://${targetHost}:${targetPort}`});
      }
    } else if (pathName === openKnockingSeq[openKnockingIdx]) {
      // Cancel auto-close timer
      autoCloseTimer.cancel();
      // Proceed open knocking
      openKnockingIdx++;
      if (openKnockingIdx === openKnockingSeq.length) {
        // Set limit of HTTP request
        currHttpRequestLimit = httpRequestLimit;
        // Set limit of on-upgrade limit
        currOnUpgradeLimit   = onUpgradeLimit;
        // Open the server
        isOpen = true;
        // Set open/close indexes
        resetIdxs();
        // Set close-timer if millis are defined
        setCloseTimerIfDefined(autoCloseTimer, autoCloseMillis);

        res.end("Open\n");
      } else {
        // Set knocking-max-interval timer if millis are defined
        setCloseTimerIfDefined(openKnockingMaxIntervalTimer, openKnockingMaxIntervalMillis);

        if (pageType === undefined) {
          res.end();
        } else {
          switch (pageType.kind) {
            // If fakeNginx is enable
            case "FakeNginx500PageType":
              // Return fake Nginx response
              fakeResGenerator.nginx(res, pageType.nginxVersion, req.headers["user-agent"] || "");
              break;
            // If empty response is enable
            case "EmptyResponsePageType":
              // Close connection
              req.connection.end();
              break;
          }
        }
      }
    } else {
      if (pageType === undefined) {
        // Do nothing
        res.end();
      } else {
        switch (pageType.kind) {
          // If fakeNginx is enable
          case "FakeNginx500PageType":
            // Return fake Nginx response
            fakeResGenerator.nginx(res, pageType.nginxVersion, req.headers["user-agent"] || "");
            break;
          // If empty response is enable
          case "EmptyResponsePageType":
            // Close connection
            req.connection.end();
            break;
        }
      }
    }
  });


  server.on('close', ()=>{
    // If autoKnockingUpdateTimer is defined
    if(autoKnockingUpdateTimer !== undefined) {
      // Clear autoKnockingUpdateTimer
      clearTimeout(autoKnockingUpdateTimer);
    }
  });


  if(enableWebSocket) {
    // WebSocket server proxy
    server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: any) => {
      if (isOpen) {
        if (currOnUpgradeLimit !== undefined) {
          // Decrement on-upgrade limit
          currOnUpgradeLimit--;
          // If server reached on-upgrade limit
          if (currOnUpgradeLimit <= 0) {
            // Close server
            closeServer();
          }
        }
        proxy.ws(req, socket, head);
      } else {
        // Close this connection
        socket.destroy();
      }
    });
  }

  return server;
}