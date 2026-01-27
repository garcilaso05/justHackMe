import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const root = process.cwd();

const server = createServer(async (req, res) => {
  const url = req.url === "/" ? "/index.html" : req.url;
  const filePath = join(root, url);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "text/plain" });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

const port = 5173;
server.listen(port, () => {
  console.log(`Servidor en http://localhost:${port}`);
});
