import * as http   from 'http';
import * as assert from 'power-assert';
import thenRequest from 'then-request';
import * as express from 'express';

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

      return app.listen(targetServerPort);
    })();


    after(async () => {
      await targetServer.close();
    });


    it("should close by default", async ()=>{
      const knockingPort: number = 6677;
      const knockingUrl: string = `http://localhost:${knockingPort}`;
      const openKnockingSeq: string[] = ["82", "delta", "echo"];
      const closeKnockingSeq: string[] = ["alpha", "one", "one", "three"];
      const server = knockingServer.createKnockingServer(
        knockingUrl,
        openKnockingSeq,
        closeKnockingSeq
      );
      await server.listen(knockingPort);

      const res = await thenRequest("GET", knockingUrl);
      assert.equal(res.statusCode,200);
      assert.equal(res.getBody("UTF-8"), "");

      await server.close();
    });
  });

});