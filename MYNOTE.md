# My Note

## Develop

The following command runs a http-knocking server on port 8282.

```bash
```bash
cd <this repo>
npm install
npm start -- --port=8282 --target-host=example.com --target-port=80 --open-knocking="/alpha,/foxtrot,/lima"
```

If it is open, you can see "404 - Not Found" which is <http://example.com>. So, if you see "404", it is OK.
