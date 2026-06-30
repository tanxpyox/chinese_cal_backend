#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(__dirname, "..", "data");
const port = Number(process.env.PORT || 8787);

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  const requestedPath = url.pathname === "/" ? "/today.json" : url.pathname;
  const resolved = path.resolve(dataRoot, `.${requestedPath}`);

  if (!resolved.startsWith(dataRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (error, body) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(body);
  });
});

server.listen(port, () => {
  console.log(`Serving ${dataRoot}`);
  console.log(`Today: http://localhost:${port}/today.json`);
});

