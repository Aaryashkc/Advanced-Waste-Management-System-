import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";
import mongoose from "mongoose";

const requestContext = new AsyncLocalStorage();
const DEFAULT_SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 250);
const MAX_SERIES = 1000;

const counters = new Map();
const histograms = new Map();
const gauges = new Map();

function normalizeLabelValue(value) {
  if (value === undefined || value === null || value === "") return "unknown";
  return String(value);
}

function labelKey(labels = {}) {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${normalizeLabelValue(labels[key])}`)
    .join(",");
}

function metricKey(name, labels) {
  return `${name}{${labelKey(labels)}}`;
}

function labelsToObject(labels = {}) {
  return Object.fromEntries(
    Object.entries(labels).map(([key, value]) => [key, normalizeLabelValue(value)])
  );
}

function ensureSeries(map, key, initialValue) {
  if (!map.has(key)) {
    if (map.size >= MAX_SERIES) return null;
    map.set(key, initialValue);
  }
  return map.get(key);
}

export function getRequestContext() {
  return requestContext.getStore() || {};
}

export function withRequestContext(context, fn) {
  return requestContext.run({ ...getRequestContext(), ...context }, fn);
}

export function updateRequestContext(fields) {
  const store = requestContext.getStore();
  if (store) Object.assign(store, fields);
}

export const metrics = {
  increment(name, labels = {}, value = 1) {
    const key = metricKey(name, labels);
    const series = ensureSeries(counters, key, {
      name,
      labels: labelsToObject(labels),
      value: 0,
    });
    if (series) series.value += value;
  },

  observe(name, value, labels = {}) {
    const key = metricKey(name, labels);
    const series = ensureSeries(histograms, key, {
      name,
      labels: labelsToObject(labels),
      count: 0,
      sum: 0,
      min: Number.POSITIVE_INFINITY,
      max: 0,
    });
    if (!series) return;
    series.count += 1;
    series.sum += value;
    series.min = Math.min(series.min, value);
    series.max = Math.max(series.max, value);
  },

  setGauge(name, value, labels = {}) {
    const key = metricKey(name, labels);
    const series = ensureSeries(gauges, key, {
      name,
      labels: labelsToObject(labels),
      value: 0,
    });
    if (series) series.value = value;
  },

  snapshot() {
    return {
      counters: Array.from(counters.values()),
      histograms: Array.from(histograms.values()).map((series) => ({
        ...series,
        avg: series.count ? series.sum / series.count : 0,
        min: Number.isFinite(series.min) ? series.min : 0,
      })),
      gauges: Array.from(gauges.values()),
    };
  },

  prometheus() {
    const lines = [];
    for (const series of counters.values()) {
      lines.push(`${formatMetric(series.name, series.labels)} ${series.value}`);
    }
    for (const series of histograms.values()) {
      lines.push(`${formatMetric(`${series.name}_count`, series.labels)} ${series.count}`);
      lines.push(`${formatMetric(`${series.name}_sum`, series.labels)} ${series.sum}`);
      lines.push(`${formatMetric(`${series.name}_min`, series.labels)} ${Number.isFinite(series.min) ? series.min : 0}`);
      lines.push(`${formatMetric(`${series.name}_max`, series.labels)} ${series.max}`);
    }
    for (const series of gauges.values()) {
      lines.push(`${formatMetric(series.name, series.labels)} ${series.value}`);
    }
    return `${lines.join("\n")}\n`;
  },
};

function formatMetric(name, labels) {
  const entries = Object.entries(labels || {});
  if (!entries.length) return name;
  const formatted = entries
    .map(([key, value]) => `${key}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `${name}{${formatted}}`;
}

function serializeError(error) {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    code: error.code,
    status: error.status || error.statusCode,
  };
}

function sanitizeMeta(meta = {}) {
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined && value !== null)
  );
}

export const logger = {
  info(message, meta = {}) {
    writeLog("info", message, meta);
  },
  warn(message, meta = {}) {
    writeLog("warn", message, meta);
  },
  error(message, meta = {}) {
    writeLog("error", message, meta);
  },
};

function writeLog(level, message, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeMeta(getRequestContext()),
    ...sanitizeMeta(meta),
  };
  if (payload.error instanceof Error) {
    payload.error = serializeError(payload.error);
  }
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function reportError(error, meta = {}) {
  metrics.increment("errors_total", {
    source: meta.source || "backend",
    route: meta.route || getRequestContext().route || "unknown",
  });
  logger.error(meta.message || error?.message || "Unhandled error", {
    ...meta,
    error,
  });
}

export function requestObservability(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const route = `${req.method} ${req.baseUrl || ""}${req.route?.path || req.path}`;

  requestContext.run({ requestId, route }, () => {
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const finalRoute = `${req.method} ${req.baseUrl || ""}${req.route?.path || req.path}`;
      const labels = {
        route: finalRoute,
        method: req.method,
        status: res.statusCode,
      };
      metrics.observe("api_latency_ms", durationMs, labels);
      metrics.increment("api_requests_total", labels);
      logger.info("HTTP request completed", {
        requestId,
        userId: req.user?._id,
        orgId: req.user?.orgId,
        route: finalRoute,
        method: req.method,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    });
    next();
  });
}

export function instrumentMongoose({ slowQueryMs = DEFAULT_SLOW_QUERY_MS } = {}) {
  if (mongoose.__observabilityInstrumented) return;
  mongoose.__observabilityInstrumented = true;

  const originalQueryExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = async function instrumentedQueryExec(...args) {
    const startedAt = process.hrtime.bigint();
    const model = this.model?.modelName || "unknown";
    const operation = this.op || "query";
    try {
      return await originalQueryExec.apply(this, args);
    } finally {
      recordMongoDuration(startedAt, { model, operation, slowQueryMs });
    }
  };

  const originalAggregateExec = mongoose.Aggregate.prototype.exec;
  mongoose.Aggregate.prototype.exec = async function instrumentedAggregateExec(...args) {
    const startedAt = process.hrtime.bigint();
    const model = this._model?.modelName || "unknown";
    try {
      return await originalAggregateExec.apply(this, args);
    } finally {
      recordMongoDuration(startedAt, {
        model,
        operation: "aggregate",
        slowQueryMs,
        aggregatePipelineLength: this._pipeline?.length,
      });
    }
  };
}

function recordMongoDuration(startedAt, { model, operation, slowQueryMs, aggregatePipelineLength }) {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  metrics.observe("mongo_query_duration_ms", durationMs, { model, operation });
  if (operation === "aggregate" || durationMs >= slowQueryMs) {
    logger.warn("Mongo query timing", {
      model,
      operation,
      durationMs: Math.round(durationMs),
      slow: durationMs >= slowQueryMs,
      aggregatePipelineLength,
    });
  }
}

export async function observeAsync(metricName, labels, fn) {
  const startedAt = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    metrics.observe(metricName, durationMs, labels);
  }
}

export function runObservedCron(name, fn) {
  return async () => {
    const startedAt = process.hrtime.bigint();
    try {
      const result = await fn();
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      metrics.observe("cron_job_duration_ms", durationMs, { job: name, status: "success" });
      metrics.increment("cron_job_runs_total", { job: name, status: "success" });
      logger.info("Cron job completed", { job: name, status: "success", durationMs: Math.round(durationMs) });
      return result;
    } catch (error) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      metrics.observe("cron_job_duration_ms", durationMs, { job: name, status: "failure" });
      metrics.increment("cron_job_runs_total", { job: name, status: "failure" });
      reportError(error, { source: "cron", job: name, durationMs: Math.round(durationMs) });
      throw error;
    }
  };
}
