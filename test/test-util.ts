import * as websocket from 'websocket';
import * as WebSocket from 'ws';

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
