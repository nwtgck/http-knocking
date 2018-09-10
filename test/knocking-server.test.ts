import * as http   from 'http';
import * as assert from 'power-assert';
import thenRequest from 'then-request';
import * as express from 'express';
import * as websocket from 'websocket';
import * as WebSocket from 'ws';
import * as testUtil from './test-util';

import * as knockingServer from '../src/knocking-server';


/**
 * Assert Knocking server is open
 * @param knockingPort
 */
async function assertKnockingServerIsOpen(knockingPort: number): Promise<void> {
  // Define knocking URL
  const knockingUrl: string = `http://localhost:${knockingPort}`;

  let res;
  res = await thenRequest("GET", `${knockingUrl}/`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.getBody("UTF-8"), "This is top page!\n");

  res = await thenRequest("GET", `${knockingUrl}/about`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.getBody("UTF-8"), "This is about page\n");

  let ws: WebSocket | undefined = undefined;
  try {
    ws = new WebSocket(`ws://localhost:${knockingPort}`);
    // Wait for open
    await testUtil.wsOnOpenPromise(ws);
    // Send a message
    ws.send("hello");
    // Wait for a response
    const data = await testUtil.wsOnMessagePromise(ws);
    // Ensure the response is "<message>+!!"
    assert.equal(data, "hello!!");
  } finally {
    if(ws !== undefined) {
      // Close ws
      await testUtil.wsClosePromise(ws);
    }
  }
}

/**
 * Assert Knocking server is closed
 * @param knockingPort
 */
async function assertKnockingServerIsClosed(knockingPort: number): Promise<void> {
  // Define knocking URL
  const knockingUrl: string = `http://localhost:${knockingPort}`;

  let res;
  res = await thenRequest("GET", `${knockingUrl}/`);
  assert.equal(res.statusCode,200);
  assert.equal(res.getBody("UTF-8"), "");

  res = await thenRequest("GET", `${knockingUrl}/about`);
  assert.equal(res.statusCode,200);
  assert.equal(res.getBody("UTF-8"), "");

  // WebSocket connection should be rejected
  const wsConnected = await testUtil.wsIsConnectedPromise(`ws://localhost:${knockingPort}`);
  assert.equal(wsConnected, false);
}

describe("knockingServer", ()=>{
  context("createKnockingServer", ()=>{

    const targetServerPort: number = 8181;
    const targetServer: http.Server = (()=>{
      const app = express();

      app.get('/', (req, res)=>{
        res.send("This is top page!\n");
      });

      app.get('/about', (req, res)=>{
        res.send("This is about page\n");
      });

      // HTTP server
      const server = app.listen(targetServerPort);

      // WebSocket server
      const wsServer = new websocket.server({
        httpServer: server,
        // You should not use autoAcceptConnections for production
        // applications, as it defeats all standard cross-origin protection
        // facilities built into the protocol and the browser.  You should
        // *always* verify the connection's origin and decide whether or not
        // to accept it.
        autoAcceptConnections: false
      });

      // (from: https://qiita.com/n0bisuke/items/cb6216dbb9c3c13a10a8)
      wsServer.on('request', function(request: websocket.request) {
        const connection = request.accept('', request.origin);
        connection.on('message', function(message) {
          if (message.type === 'utf8') {
            connection.sendUTF(message.utf8Data + "!!");
          }
        });
        connection.on('close', function(reasonCode, description) {
        });
      });

      return server;
    })();


    after(async () => {
      await targetServer.close();
    });


    it("should be closed by default", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        knockingPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);

      // Assert the knocking server is closed
      await assertKnockingServerIsClosed(knockingPort);

      await server.close();
    });


    it("should open by open-knocking sequence", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      await server.listen(knockingPort);

      try {
        let res;

        res = await thenRequest("GET", `${knockingUrl}/82`);
        assert.equal(res.statusCode, 200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/delta`);
        assert.equal(res.statusCode, 200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/echo`);
        assert.equal(res.statusCode, 200);
        assert.equal(res.getBody("UTF-8"), "Open\n");

        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);
      } finally  {
        // // Close the server
        await server.close();
      }
    });

    it("should open by open-knocking sequence with other requests", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        let res;
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        res = await thenRequest("GET", `${knockingUrl}/echo`);
        assert.equal(res.getBody("UTF-8"), "Open\n");

        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);
      } finally {
        await server.close();
      }
    });

    it("should close by close-knocking sequence", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        let res;
        // Check whether the server is open
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "This is top page!\n");


        res = await thenRequest("GET", `${knockingUrl}/alpha`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/one`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/one`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/three`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "Closed\n");


        // Assert the knocking server is closed
        await assertKnockingServerIsClosed(knockingPort);
      } finally {
        await server.close();
      }
    });

    it("should close by close-knocking sequence with other requests", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        let res;

        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/alpha`);
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/one`);
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/one`);
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy2`); // NOTE: dummy request
        await thenRequest("GET", `${knockingUrl}/dummy1`); // NOTE: dummy request
        res = await thenRequest("GET", `${knockingUrl}/three`);
        assert.equal(res.getBody("UTF-8"), "Closed\n");

        // Assert the knocking server is closed
        await assertKnockingServerIsClosed(knockingPort);
      } finally {
        await server.close();
      }
    });

    it("should close automatically by time", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        5000, // 5sec
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // Check whether the server is open
        await assertKnockingServerIsOpen(knockingPort);

        // Wait for 2sec
        await testUtil.sleep(2000);

        // Check whether the server is open
        await assertKnockingServerIsOpen(knockingPort);

        // Wait for 4sec
        await testUtil.sleep(4000);

        // Assert the knocking server is closed
        await assertKnockingServerIsClosed(knockingPort);
      } finally {
        await server.close();
      }
    });

    it("should cancel auto-close-by-time by manual close", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        5000, // 5sec
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        const open = async()=>{
          await thenRequest("GET", `${knockingUrl}/82`);
          await thenRequest("GET", `${knockingUrl}/delta`);
          await thenRequest("GET", `${knockingUrl}/echo`);
        };

        const close = async()=>{
          await thenRequest("GET", `${knockingUrl}/alpha`);
          await thenRequest("GET", `${knockingUrl}/one`);
          await thenRequest("GET", `${knockingUrl}/one`);
          await thenRequest("GET", `${knockingUrl}/three`);
        };

        // Open
        await open();
        // Close
        await close();
        // Wait for 2.0sec
        await testUtil.sleep(2000);
        // Open
        await open();
        // Wait for 4.0sec
        await testUtil.sleep(4000);
        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);

      } finally {
        await server.close();
      }
    });

    it("should open under open-knocking max interval", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        2000, // 2sec
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        // Wait for 1.0sec
        await testUtil.sleep(1000);
        await thenRequest("GET", `${knockingUrl}/delta`);
        // Wait for 1.2sec
        await testUtil.sleep(1200);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);
      } finally {
        await server.close();
      }
    });

    it("should close over open-knocking max interval, and open in correct way", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        2000, // 2sec
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      await server.listen(knockingPort);


      try {
        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        // Wait for 1.0sec
        await testUtil.sleep(1000);
        await thenRequest("GET", `${knockingUrl}/delta`);
        // Wait for 3.0sec // NOTE: Over 2sec
        await testUtil.sleep(3000);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // Assert the knocking server is closed
        await assertKnockingServerIsClosed(knockingPort);

        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);

      } finally {
        await server.close();
      }
    });

    it("should connect restricted number of HTTP requests", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      // HTTP request limit
      const httpRequestLimit: number = 3;
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        httpRequestLimit,
        undefined,
        undefined,
        undefined,
        true
      );

      await server.listen(knockingPort);

      try {
        // Open knocking server
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // NOTE: Don' use `assertKnockingServerIsOpen()` to check whether server is open or not
        //       because `assertKnockingServerIsOpen()` consumes connections.

        // Connect Opened HTTP server `httpRequestLimit`-times
        for(let i = 0; i < httpRequestLimit;i ++) {
          const res = await thenRequest("GET", `${knockingUrl}/`);
          assert.equal(res.statusCode, 200);
          assert.equal(res.getBody("UTF-8"), "This is top page!\n");
        }

        // Assert the knocking server is closed
        await assertKnockingServerIsClosed(knockingPort);

      } finally  {
        // // Close the server
        await server.close();
      }
    });

    it("should connect restricted number of on-upgrade", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      // On-upgrade limit
      const onUpgradeRequestLimit: number = 3;
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        onUpgradeRequestLimit,
        undefined,
        undefined,
        true
      );

      await server.listen(knockingPort);

      try {
        // Open knocking server
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // NOTE: Don' use `assertKnockingServerIsOpen()` to check whether server is open or not
        //       because `assertKnockingServerIsOpen()` consumes connections.

        // Connect Opened HTTP server `onUpgradeRequestLimit`-times
        for(let i = 0; i < onUpgradeRequestLimit;i ++) {
          let ws: WebSocket | undefined = undefined;
          try {
            ws = new WebSocket(`ws://localhost:${knockingPort}`);
            // Wait for open
            await testUtil.wsOnOpenPromise(ws);
            // Send a message
            ws.send("hello");
            // Wait for a response
            const data = await testUtil.wsOnMessagePromise(ws);
            // Ensure the response is "<message>+!!"
            assert.equal(data, "hello!!");
          } finally {
            if(ws !== undefined) {
              // Close ws
              await testUtil.wsClosePromise(ws);
            }
          }
        }

        // Assert the knocking server is closed
        await assertKnockingServerIsClosed(knockingPort);

      } finally  {
        // // Close the server
        await server.close();
      }
    });

    it("should return fake Nginx Internal Server Error", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const fakeNginxVersion: string = "1.15.1";
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          kind: "FakeNginx500PageType",
          nginxVersion: fakeNginxVersion
        },
        undefined,
        true
      );

      // Response string of Nginx "Internal Server Error"
      function getInternalServerErrorRes(): string {
        // (INFO: Ruby one-liner(localhost:8181 is an actual Nginx Server): puts `curl -i localhost:8081`.split("\r\n").map{|e| (e+"\r\n").inspect}.join(" +\n")
        return (
          "HTTP/1.1 500 Internal Server Error\r\n" +
          `Server: nginx/${fakeNginxVersion}\r\n` +
          `Date: ${new Date().toUTCString()}\r\n` +
          "Content-Type: text/html\r\n" +
          "Content-Length: 193\r\n" +
          "Connection: close\r\n" +
          "\r\n" +
          "<html>\r\n" +
          "<head><title>500 Internal Server Error</title></head>\r\n" +
          "<body bgcolor=\"white\">\r\n" +
          "<center><h1>500 Internal Server Error</h1></center>\r\n" +
          `<hr><center>nginx/${fakeNginxVersion}</center>\r\n` +
          "</body>\r\n" +
          "</html>\r\n"
        )
      }

      await server.listen(knockingPort);

      // Assert server is closed
      async function assertClosedForFakeNginx(): Promise<void> {
        let resBuffer: Buffer;
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/");
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), getInternalServerErrorRes());

        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/about");
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), getInternalServerErrorRes());
      }

      try {
        let resBuffer: Buffer;
        let res;

        // Assert server is closed
        await assertClosedForFakeNginx();

        // === Begin open sequence ===
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/82");
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), getInternalServerErrorRes());
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/delta");
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), getInternalServerErrorRes());
        res = await thenRequest("GET", `${knockingUrl}/echo`);
        // Response should be "Open"
        assert.equal(res.getBody("UTF-8"), "Open\n");
        // === End open sequence ===

        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);

        res = await thenRequest("GET", `${knockingUrl}/alpha`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/one`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/one`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/three`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "Closed\n");

        // Assert server is closed
        await assertClosedForFakeNginx();

      } finally {
        await server.close();
      }
    });

    it("should return fake Nginx Internal Server Error with padding", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const fakeNginxVersion: string = "1.15.1";
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          kind: "FakeNginx500PageType",
          nginxVersion: fakeNginxVersion
        },
        undefined,
        true
      );

      // Response string of Nginx "Internal Server Error" with padding
      function getInternalServerErrorRes(): string {
        // (INFO: Ruby one-liner(localhost:8181 is an actual Nginx Server): puts `curl -i -H 'User-Agent: Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1)' localhost:8081`.split("\r\n").map{|e| (e+"\r\n").inspect}.join(" +\n")
        return (
          "HTTP/1.1 500 Internal Server Error\r\n" +
          `Server: nginx/${fakeNginxVersion}\r\n` +
          `Date: ${new Date().toUTCString()}\r\n` +
          "Content-Type: text/html\r\n" +
          "Content-Length: 595\r\n" +
          "Connection: close\r\n" +
          "\r\n" +
          "<html>\r\n" +
          "<head><title>500 Internal Server Error</title></head>\r\n" +
          "<body bgcolor=\"white\">\r\n" +
          "<center><h1>500 Internal Server Error</h1></center>\r\n" +
          `<hr><center>nginx/${fakeNginxVersion}</center>\r\n` +
          "</body>\r\n" +
          "</html>\r\n" +
          "<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n" +
          "<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n" +
          "<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n" +
          "<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n" +
          "<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n" +
          "<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n"
        )
      }

      await server.listen(knockingPort);

      // Assert server is closed
      async function assertClosedForFakeNginx(headers: {[header: string]: string}): Promise<void> {
        let resBuffer: Buffer;
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/", headers);
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), getInternalServerErrorRes());

        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/about", headers);
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), getInternalServerErrorRes());
      }

      try {
        // Assert server is closed with padding
        await assertClosedForFakeNginx({
          // IE
          "User-Agent": "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1)"
        });

        // Assert server is closed with padding
        await assertClosedForFakeNginx({
          // Chrome
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36"
        });

      } finally {
        await server.close();
      }
    });

    it("should return empty response", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const fakeNginxVersion: string = "1.15.1";
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          kind: "EmptyResponsePageType",
        },
        undefined,
        true
      );

      await server.listen(knockingPort);

      // Assert server is closed
      async function assertClosedForEmptyResponse(): Promise<void> {
        let resBuffer: Buffer;
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/");
        // Response should be empty
        assert.equal(resBuffer.toString(), "");

        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/about");
        // Response should be empty"
        assert.equal(resBuffer.toString(), "");
      }

      try {
        let resBuffer: Buffer;
        let res;

        // Assert server is closed
        await assertClosedForEmptyResponse();

        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/");

        // === Begin open sequence ===
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/82");
        // Response should be empty
        assert.equal(resBuffer.toString(), "");
        resBuffer = await testUtil.httpGet("localhost", knockingPort, "/delta");
        // Response should be Nginx "Internal Server Error"
        assert.equal(resBuffer.toString(), "");
        res = await thenRequest("GET", `${knockingUrl}/echo`);
        // Response should be "Open"
        assert.equal(res.getBody("UTF-8"), "Open\n");
        // === End open sequence ===

        // Assert the knocking server is open
        await assertKnockingServerIsOpen(knockingPort);

        res = await thenRequest("GET", `${knockingUrl}/alpha`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/one`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/one`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/three`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "Closed\n");

        // Assert server is closed
        await assertClosedForEmptyResponse();

      } finally {
        await server.close();
      }
    });


    it("should update knocking sequence automatically", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      // (NOTE: These sequences will be updated in notificationCallback)
      let updatedOpenKnockingSeq: string[]  = [];
      let updatedCloseKnockingSeq: string[] =[];
      const nKnockings: number = 3;
      const server = knockingServer.createKnockingServer(
        "localhost",
        targetServerPort,
        openKnockingSeq,
        closeKnockingSeq,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          intervalMillis: 2000,
          minLength: 7,
          maxLength: 11,
          nKnockings: nKnockings,
          notificationCallback: (async (newOpenSeq: string[], newCloseSeq: string[]) => {
            // Update sequences
            updatedOpenKnockingSeq  = newOpenSeq;
            updatedCloseKnockingSeq = newCloseSeq;
          })
        },
        true
      );

      await server.listen(knockingPort);

      try {

        // Wait for a just moment
        await testUtil.sleep(500);

        // Test 3 times
        for(let i = 0; i < 3; i++) {

          // Assert open-sequence length should be nKnockings
          assert.equal(updatedOpenKnockingSeq.length, nKnockings);
          assert.equal(updatedCloseKnockingSeq.length, nKnockings);

          // Open knocking-server by visiting path
          for (let openPath of updatedOpenKnockingSeq) {
            // (NOTE: openPath start with "/")
            await thenRequest("GET", `${knockingUrl}${openPath}`);
          }
          // Assert the knocking server is open
          await assertKnockingServerIsOpen(knockingPort);

          // Close knocking-server by visiting path
          for (let closePath of updatedCloseKnockingSeq) {
            // (NOTE: openPath start with "/")
            await thenRequest("GET", `${knockingUrl}${closePath}`);
          }
          // Assert the knocking server is open
          await assertKnockingServerIsClosed(knockingPort);

          await testUtil.sleep(2500);
        }
      } finally {
        await server.close();
      }
    });

  });

});