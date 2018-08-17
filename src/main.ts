import * as process   from 'process';
import * as yargs     from 'yargs';
import * as knockingServer from './knocking-server'

// Create option parser
const parser = yargs
  .option("port", {
    demandOption: true
  })
  .option("target-url", {
    demandOption: true
  })
  .option("open-knocking", {
    demandOption: true
  })
  .option("close-knocking", {
    demandOption: false
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

  // Create a knocking server
  const server = knockingServer.createKnockingServer(
    targetUrl,
    openKnockingSeq,
    closeKnockingSeq
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


