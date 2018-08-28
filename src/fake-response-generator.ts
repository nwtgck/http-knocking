import * as http from "http";

export function nginx(res: http.ServerResponse): void {
  // TODO: Hard code nginx version
  // TODO: Hard code "<!-- a padding to disable MSIE and Chrome friendly error page -->"
  const body = "<html>\r\n<head><title>500 Internal Server Error</title></head>\r\n<body bgcolor=\"white\">\r\n<center><h1>500 Internal Server Error</h1></center>\r\n<hr><center>nginx/1.15.2</center>\r\n</body>\r\n</html>\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n<!-- a padding to disable MSIE and Chrome friendly error page -->\r\n";
  res.writeHead(500, "Internal Server Error", {
    // TODO: Hard code nginx version
    "Server": `nginx/1.15.2`,
    "Date": new Date().toUTCString(), // (from: https://github.com/nodejs/node/blob/8b4af64f50c5e41ce0155716f294c24ccdecad03/lib/internal/http.js#L9)
    "Content-Type": "text/html",
    "Content-Length": body.length,
    "Connection": "close"
  });
  res.write(body);
}