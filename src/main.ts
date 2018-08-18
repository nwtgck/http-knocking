import * as process   from 'process';
import * as yargs     from 'yargs';
import * as knockingServer from './knocking-server'

// Create option parser
const parser = yargs
  .option("port", {
    describe: 'Port of knocking server',
    demandOption: true
  })
  .option("target-url", {
    describe: 'Target URL to hide',
    demandOption: true
  })
  .option("open-knocking", {
    describe: 'Open-knocking sequence (e.g. "/alpha,/foxtrot,/lima")',
    demandOption: true
  })
  .option("close-knocking", {
    describe: 'Close-knocking sequence (e.g. "/victor,/kilo")',
    demandOption: false
  })
  .option("auto-close-millis", {
    describe: 'Time millis to close automatically',
    demandOption: false,
  });

try {
  // Parse arguments
  const args = parser.parse(process.argv);

  // Get server port
  const port: string      = args['port'];
  // Get target URL
  const targetUrl: string = args['target-url'];
  // Get open knocking sequence
  const openKnockingSeq: string[]  = args['open-knocking'].split(",");
  // Get close knocking sequence
  const closeKnockingSeq: string[] = args['close-knocking'] === undefined ? openKnockingSeq.slice().reverse() : args['close-knocking'].split(",");
  // Get auto-close millis
  const autoCloseMillis: number | undefined = args['auto-close-millis'];

  // Create a knocking server
  const server = knockingServer.createKnockingServer(
    targetUrl,
    openKnockingSeq,
    closeKnockingSeq,
    autoCloseMillis
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


