import * as http   from 'http';
import * as assert from 'power-assert';
import thenRequest from 'then-request';
import * as express from 'express';
import * as websocket from 'websocket';
import * as WebSocket from 'ws';
import * as testUtil from './test-util';

import * as knockingServer from '../src/knocking-server';


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
        true
      );
      await server.listen(knockingPort);

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

        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode, 200);
        assert.equal(res.getBody("UTF-8"), "This is top page!\n");

        res = await thenRequest("GET", `${knockingUrl}/about`);
        assert.equal(res.statusCode, 200);
        assert.equal(res.getBody("UTF-8"), "This is about page\n");


        let ws: WebSocket;
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
          if(ws) {
            // Close ws
            await testUtil.wsClosePromise(ws);
          }
        }
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
        false,
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

        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "This is top page!\n");

        res = await thenRequest("GET", `${knockingUrl}/about`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "This is about page\n");
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
        false,
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


        // Check whether the server is closed
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/about`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");
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
        false,
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


        // Check whether the server is closed
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/about`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");
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
        false,
        5000, // 5sec
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

        // Wait for 2sec
        await testUtil.sleep(2000);

        // Check whether the server is open
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "This is top page!\n");

        // Wait for 4sec
        await testUtil.sleep(4000);

        // Check whether the server is closed
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/about`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");
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
        false,
        undefined,
        2000, // 2sec
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

        let res;
        // Check whether the server is open
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "This is top page!\n");

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
        false,
        undefined,
        2000, // 2sec
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

        let res;
        // Check whether the server is closed
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");


        // Open the server by knocking
        await thenRequest("GET", `${knockingUrl}/82`);
        await thenRequest("GET", `${knockingUrl}/delta`);
        await thenRequest("GET", `${knockingUrl}/echo`);

        // Check whether the server is open
        res = await thenRequest("GET", `${knockingUrl}/`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "This is top page!\n");

      } finally {
        await server.close();
      }
    });

  });

});