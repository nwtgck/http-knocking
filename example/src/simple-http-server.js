const http         = require("http");
const httpKnocking = require("http-knocking");

const knockingPort = 8080;
const hiddenPort   = 52256;

// Run a hidden server
http.createServer((req, res)=>{
  res.end("<h1>This is a hidden content!</h1>")
}).listen(hiddenPort, ()=>{
  console.log("Hidden server is running...");
});

// Run a knocking server
httpKnocking.createKnockingServer(
  "localhost",
  hiddenPort,
  ["/alpha", "/foxtrot", "/lima"],
  ["/lima", "/foxtrot", "/alpha"]
).listen(knockingPort, ()=>{
  console.log(`Knockig server is listenning on ${knockingPort}...`);
});
