#!/usr/bin/env node

// "env node" is for executable
// (from: https://qiita.com/takayukioda/items/a149bc2907ef77121229)

import * as process   from 'process';
import * as fs from "fs";
import * as assert    from "assert";
import * as yargs     from 'yargs';
import * as knockingServer from './knocking-server'
import * as jsonTemplates from "json-templates";
import {AssertionError} from "assert";

/**
 * Unwrap union type of T and undefined
 * @param value
 */
function unwrapUndefined<T>(value: T | undefined): T {
  return value as T;
}

// Create option parser
const parser = yargs
  .option("port", {
    describe: 'Port of knocking server',
    type: "number",
    demandOption: true
  })
  .option("target-host", {
    describe: 'Target host to hide',
    type: "string",
    demandOption: true
  })
  .option("target-port", {
    describe: 'Target port to hide',
    type: "number",
    demandOption: false,
    default: 80
  })
  .option("open-knocking", {
    describe: 'Open-knocking sequence (e.g. "/alpha,/foxtrot,/lima")',
    type: "string",
    demandOption: false
  })
  .option("close-knocking", {
    describe: 'Close-knocking sequence (e.g. "/victor,/kilo")',
    type: "string",
    demandOption: false
  })
  .option("enable-websocket", {
    describe: 'Enable WebSocket proxy',
    demandOption: false,
    default: false
  })
  .option("auto-close-millis", {
    describe: 'Time millis to close automatically',
    type: "number",
    demandOption: false,
  })
  .option("open-knocking-max-interval-millis", {
    describe: 'Time millis to reset open procedure',
    type: "number",
    demandOption: false,
  })
  .option("http-request-limit", {
    describe: 'Limit of HTTP request',
    type: "number",
    demandOption: false,
  })
  .option("on-upgrade-limit", {
    describe: 'Limit of on-upgrade (WebSocket)',
    type: "number",
    demandOption: false,
  })
  .option("enable-fake-nginx", {
    describe: 'Enable fake Nginx Internal Server Error response',
    demandOption: false,
    default: false
  })
  .option("fake-nginx-version", {
    describe: 'Nginx version in fake Nginx Internal Server Error response',
    demandOption: false,
    default: "1.15.2"
  })
  .option("enable-empty-response", {
    describe: 'Enable empty response (NOTE: Not empty HTTP body)',
    demandOption: false,
    default: false
  })
  .option("enable-knocking-update", {
    describe: 'Enable auto knocking-update',
    demandOption: false,
    default: false
  })
  .option("knocking-update-interval-sec", {
    describe: 'Interval millis of auto knocking-update',
    demandOption: false,
    default: 1800
  })
  .option("min-knocking-length", {
    describe: 'Min knocking length used in auto knocking-update',
    demandOption: false,
    default: 6
  })
  .option("max-knocking-length", {
    describe: 'Max knocking length used in auto knocking-update',
    demandOption: false,
    default: 8
  })
  .option("n-knockings", {
    describe: 'The number of knocking sequence used in auto knocking-update',
    demandOption: false,
    default: 3
  })
  .option("webhook-url", {
    describe: 'Webhook URL used in auto knocking-update',
    type: "string",
    demandOption: false,
  })
  .option("webhook-template-path", {
    describe: 'Webhook template file path used in auto knocking-update',
    type: "string",
    demandOption: false,
  });

try {
  // Parse arguments
  const args = parser.parse(process.argv);

  // Get server port
  const port: number      = args['port'];
  // Get target host
  const targetHost: string = args['target-host'];
  // Get target port
  const targetPort: number = args['target-port'];
  // Get open knocking sequence string
  const openKnockingStr: string | undefined  = args['open-knocking'];
  // Get close knocking sequence string
  const closeKnockingStr: string | undefined = args['close-knocking'];
  // Get enable-websocket
  const enableWebSocket: boolean = args['enable-websocket'];
  // Get auto-close millis
  const autoCloseMillis: number | undefined = args['auto-close-millis'];
  // Get open-knocking max interval mills
  const openKnockingMaxIntervalMillis: number | undefined = args['open-knocking-max-interval-millis'];
  // Get http-request-limit
  const httpRequestLimit: number | undefined = args['http-request-limit'];
  // Get on-upgrade limit
  const onUpgradeLimit: number | undefined   = args['on-upgrade-limit'];
  // Get enable fake Nginx or not
  const enableFakeNginx: boolean = args['enable-fake-nginx'];
  // Get fake Nginx version
  const fakeNginxVersion: string = args['fake-nginx-version'];
  // Get enable-empty-response
  const enableEmptyResponse: boolean = args['enable-empty-response'];
  // Get enable-knocking-update
  const enableKnockingUpdate: boolean = args['enable-knocking-update'];
  // Get knocking-update-interval-sec
  const knockingUpdateIntervalSec: number = args['knocking-update-interval-sec'];
  // Get min-knocking-length
  const minKnockingLength: number = args['min-knocking-length'];
  // Get max-knocking-length
  const maxKnockingLength: number = args['max-knocking-length'];
  // Get n-knockings
  const nKnockings: number = args['n-knockings'];
  // Get webhook-url
  const webhookUrl: string | undefined = args['webhook-url'];
  // Get webhook-template-path
  const webhookTemplatePath: string | undefined = args['webhook-template-path'];

  assert(!(enableFakeNginx && enableEmptyResponse), "Don't specify both --enable-fake-nginx and --enable-empty-response options");
  
  let openKnockingSeq: string[];
  let closeKnockingSeq: string[];
  if(enableKnockingUpdate) {
    assert(minKnockingLength <= maxKnockingLength, "min-knocking-length should <= min-knocking-length");
    assert(maxKnockingLength <= 30, "max-knocking-length should <= 30");
    assert(nKnockings > 0, "n-knockings should > 0");
    assert(webhookUrl !== undefined, "webhook-url should be defined");
    assert(webhookTemplatePath !== undefined, "webhook-template-path should be defined");
    assert(fs.existsSync(unwrapUndefined(webhookTemplatePath)), "webhook-template-path should exist");

    // Set dummy openKnockingSeq and closeKnockingSeq
    // NOTE: openKnockingSeq and closeKnockingSeq should be set immediately automatically
    openKnockingSeq = ["dummy-open-path"];
    closeKnockingSeq = ["dummy-close-path"];
  } else {
    assert(openKnockingStr !== undefined, "open-knocking should be defined");

    // Set open-knocking sequence
    openKnockingSeq = unwrapUndefined(openKnockingStr).split(",");
    // Set close-knocking sequence
    closeKnockingSeq = closeKnockingStr === undefined ?
        openKnockingSeq.slice().reverse() :
        closeKnockingStr.split(",");
  }

  // Define pageType
  const pageType: knockingServer.PageType | undefined =
    (enableFakeNginx) ?
      {
        kind: "FakeNginx500PageType",
        nginxVersion: fakeNginxVersion
      } :
    (enableEmptyResponse)?
      {
        kind: "EmptyResponsePageType"
      } :
      undefined;

  // Define auto knocking-update setting
  const knockingUpdateSetting: knockingServer.KnockingUpdateSetting | undefined =
    enableKnockingUpdate ? {
      intervalMillis: knockingUpdateIntervalSec * 1000,
      minLength: minKnockingLength,
      maxLength: maxKnockingLength,
      nKnockings: nKnockings,
      notificationCallback: knockingServer.genereateWebhookNotificationCallback(
        unwrapUndefined(webhookUrl),
        jsonTemplates(
          // Read webhook template
          fs.readFileSync(unwrapUndefined(webhookTemplatePath)).toString("UTF-8")
        )
      )
    } :
    undefined;

  // Create a knocking server
  const server = knockingServer.createKnockingServer(
    targetHost,
    targetPort,
    openKnockingSeq,
    closeKnockingSeq,
    enableWebSocket,
    autoCloseMillis,
    openKnockingMaxIntervalMillis,
    httpRequestLimit,
    onUpgradeLimit,
    pageType,
    knockingUpdateSetting
  );

  server.listen(port);
  console.log(`Server is listening on ${port}...`);

  // Catch and ignore error
  process.on('uncaughtException', (err) => {
    console.error(err);
  })

} catch (err) {
  if(err instanceof AssertionError) {
    console.error("Error:", err.message);
  } else {
    console.error(err);
  }
}


