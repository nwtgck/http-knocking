import * as websocket from 'websocket';
import * as WebSocket from 'ws';
import * as net from 'net';
import * as http from 'http';

// Sleep
// (from: https://qiita.com/yuba/items/2b17f9ac188e5138319c)
export function sleep(ms: number): Promise<any> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * WebSocket on-open promise
 * @param ws
 */
export function wsOnOpenPromise(ws: WebSocket): Promise<any> {
  return new Promise<any>((resolve, reject)=>{
    const errorHandler = (err: Error) => {
      ws.removeListener('open', openHandler);
      reject(err);
    };
    const openHandler = () => {
      ws.removeListener('error', errorHandler);
      resolve();
    };
    ws.on('error', errorHandler);
    ws.on('open', openHandler);
  });
}

/**
 * WebSocket on-close promise
 * @param ws
 */
export function wsOnClosePromise(ws: WebSocket): Promise<any> {
  return new Promise<any>((resolve, reject)=>{
    const errorHandler = (err: Error) => {
      ws.removeListener('close', closeHandler);
      reject(err);
    };
    const closeHandler = () => {
      ws.removeListener('error', errorHandler);
      resolve();
    };
    ws.on('error', errorHandler);
    ws.on('close', closeHandler);
  });
}

/**
 * WebSocket close promise
 * @param ws
 */
export function wsClosePromise(ws: WebSocket): Promise<any> {
  // Close WebSocket
  ws.close();
  return wsOnClosePromise(ws);
}

/**
 * WebSocket on-message promise
 * @param ws
 */
export function wsOnMessagePromise(ws: WebSocket): Promise<any> {
  return new Promise<any>((resolve, reject)=>{
    const errorHandler = (err: Error) => {
      ws.removeListener('message', messageHandler);
      reject(err);
    };
    const messageHandler = (data: any) => {
      ws.removeListener('error', errorHandler);
      resolve(data);
    };
    ws.on('error', errorHandler);
    ws.on('message', messageHandler);
  });
}


/**
 * Whether WebSocket connection is connectable or not
 * @param url
 */
export function wsIsConnectedPromise(url: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject)=>{
    const wsClient = new websocket.client();
    wsClient.on('connect', (connection)=>{
      resolve(true);
      wsClient.abort();
    });
    wsClient.on('connectFailed', (err)=>{
      resolve(false);
    });
    wsClient.connect(url);
  });
}


/**
 * Request HTTP Get and get whole HTTP response including both head and body
 * @param host
 * @param port
 * @param getPath
 * @param headers
 */
export function httpGet(host: string, port: number, getPath: string, headers: {[head: string]: string}={}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const buffers: Buffer[] = [];
    const client = new net.Socket();
    client.connect(port, host, ()=>{
      client.write(`GET ${getPath} HTTP/1.0\n`);
      client.write(`Host: ${host}\n`);
      for(let header in headers) {
        client.write(`${header}: ${headers[header]}`)
      }
      client.write("\n\n");
    });
    client.on('data', (data)=>{
      buffers.push(data);
    });
    client.on('close', (hadError)=>{
      if(!hadError) {
        // (from: https://stackoverflow.com/a/10356183/2885946)
        resolve(Buffer.concat(buffers))
      }
    });
    client.on('error', (err: Error)=>{
      reject(err);
    });
  });
}

/**
 * Unwrap union type of T and undefined
 * @param value
 */
function unwrapUndefined<T>(value: T | undefined): T {
  return value as T;
}

type ReqRes = {req: http.IncomingMessage, res: http.ServerResponse};
type ReqResOrError =
  {
    kind: "REQ_RES",
    req: http.IncomingMessage,
    res: http.ServerResponse
  } |
  {
    kind: "ERROR",
    error: Error
  };

export class PromiseHttpServer {
  private resolveAndRejectQueue: ({resolve: (reqRes: ReqRes) => void, reject: (err: Error) => void})[] = [];
  private reqResOrErrorQueue: ReqResOrError[] = [];

  readonly server: http.Server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse)=>{
    if(this.resolveAndRejectQueue.length === 0) {
      // Push request and response
      this.reqResOrErrorQueue.push({
        kind: "REQ_RES",
        req: req,
        res: res
      });
    } else {
      // Get the first resolve and reject functions
      const resolveAndReject: {resolve: (reqRes: ReqRes) => void, reject: (err: Error) => void}
        = unwrapUndefined(this.resolveAndRejectQueue.shift());
      // Resolve
      resolveAndReject.resolve({
        req: req,
        res: res
      })
    }
  }).on('error', (err) => {
    if(this.resolveAndRejectQueue.length == 0) {
      // Push error
      this.reqResOrErrorQueue.push({
        kind: "ERROR",
        error: err
      });
    } else {
      // Get the first resolve and reject functions
      const resolveAndReject: {resolve: (reqRes: ReqRes) => void, reject: (err: Error) => void}
        = unwrapUndefined(this.resolveAndRejectQueue.shift());
      // Resolve
      resolveAndReject.reject(err);
    }
  });

  /**
   * Wait for request and response
   */
  reqRes(): Promise<ReqRes> {
    return new Promise<ReqRes>(((resolve, reject) => {
      if(this.reqResOrErrorQueue.length === 0) {
        // Append resolver
        this.resolveAndRejectQueue.push({
          resolve: resolve,
          reject: reject
        });
      } else {
        // Get the first request and response
        const reqResOrError: ReqResOrError = unwrapUndefined(this.reqResOrErrorQueue.shift());
        switch (reqResOrError.kind) {
          case "REQ_RES":
            // Resolve by the request and response
            resolve({
              req: reqResOrError.req,
              res: reqResOrError.res
            });
            break;
          case "ERROR":
            // Reject by error
            reject(reqResOrError.error);
            break;
        }
      }
    }));
  }
}