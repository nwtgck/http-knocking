#!/usr/bin/env node

// "env node" is for executable
// (from: https://qiita.com/takayukioda/items/a149bc2907ef77121229)

import * as process   from 'process';
import * as yargs     from 'yargs';
import * as knockingServer from './knocking-server'

// Create option parser
const parser = yargs
  .option("port", {
    describe: 'Port of knocking server',
    demandOption: true
  })
  .option("target-host", {
    describe: 'Target host to hide',
    demandOption: true
  })
  .option("target-port", {
    describe: 'Target port to hide',
    demandOption: false,
    default: 80
  })
  .option("open-knocking", {
    describe: 'Open-knocking sequence (e.g. "/alpha,/foxtrot,/lima")',
    demandOption: true
  })
  .option("close-knocking", {
    describe: 'Close-knocking sequence (e.g. "/victor,/kilo")',
    demandOption: false
  })
  .option("enable-websocket", {
    describe: 'Enable WebSocket proxy',
    demandOption: false,
    default: false
  })
  .option("auto-close-millis", {
    describe: 'Time millis to close automatically',
    demandOption: false,
  })
  .option("open-knocking-max-interval-millis", {
    describe: 'Time millis to reset open procedure',
    demandOption: false,
  });

try {
  // Parse arguments
  const args = parser.parse(process.argv);

  // Get server port
  const port: string      = args['port'];
  // Get target host
  const targetHost: string = args['target-host'];
  // Get target port
  const targetPort: number = args['target-port'];
  // Get open knocking sequence
  const openKnockingSeq: string[]  = args['open-knocking'].split(",");
  // Get close knocking sequence
  const closeKnockingSeq: string[] = args['close-knocking'] === undefined ? openKnockingSeq.slice().reverse() : args['close-knocking'].split(",");
  // Get enable-websocket
  const enableWebSocket: boolean = args['enable-websocket'];
  // Get auto-close millis
  const autoCloseMillis: number | undefined = args['auto-close-millis'];
  // Get open-knocking max interval mills
  const openKnockingMaxIntervalMillis: number | undefined = args['open-knocking-max-interval-millis'];
  // TODO: Add option of http-connection-limit

  // Create a knocking server
  const server = knockingServer.createKnockingServer(
    targetHost,
    targetPort,
    openKnockingSeq,
    closeKnockingSeq,
    enableWebSocket,
    autoCloseMillis,
    openKnockingMaxIntervalMillis
  );

  server.listen(port);
  console.log(`Server is listening on ${port}...`);

  // Catch and ignore error
  process.on('uncaughtException', (err) => {
    console.error(err);
  })

} catch (err) {
  console.error(err);
}


