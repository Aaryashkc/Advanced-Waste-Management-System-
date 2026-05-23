import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import app from "../app.js";
import { apiResponseMiddleware } from "../utils/apiResponse.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

test("Express app can be imported without starting the production listener", () => {
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});

test("API response middleware standardizes direct json responses", async () => {
  const testApp = express();
  testApp.use(apiResponseMiddleware);
  testApp.get("/plain", (req, res) => res.status(201).json({ message: "created" }));

  const server = http.createServer(testApp);
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/plain`);
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body, { success: true, message: "created" });
  } finally {
    await close(server);
  }
});
