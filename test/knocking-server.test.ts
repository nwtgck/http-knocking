import * as http   from 'http';
import * as assert from 'power-assert';
import thenRequest from 'then-request';
import * as express from 'express';

import * as knockingServer from '../src/knocking-server';
import qunit = Mocha.interfaces.qunit;


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

      return app.listen(targetServerPort);
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
        knockingUrl,
        openKnockingSeq,
        closeKnockingSeq,
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

      await server.close();
    });

    it("should open by open-knocking sequence", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["/82", "/delta", "/echo"];
      const closeKnockingSeq: string[] = ["/alpha", "/one", "/one", "/three"];
      const server = knockingServer.createKnockingServer(
        `http://localhost:${targetServerPort}`,
        openKnockingSeq,
        closeKnockingSeq,
        true
      );
      await server.listen(knockingPort);


      try {
        let res;
        res = await thenRequest("GET", `${knockingUrl}/82`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/delta`);
        assert.equal(res.statusCode,200);
        assert.equal(res.getBody("UTF-8"), "");

        res = await thenRequest("GET", `${knockingUrl}/echo`);
        assert.equal(res.statusCode,200);
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
        `http://localhost:${targetServerPort}`,
        openKnockingSeq,
        closeKnockingSeq,
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

  });

});