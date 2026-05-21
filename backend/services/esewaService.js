import crypto from "crypto";
import { randomUUID } from "crypto";

/**
 * eSewa ePay v2 integration service.
 *
 * Security model
 * ──────────────
 *  1. Secrets (ESEWA_SECRET_KEY, ESEWA_PRODUCT_CODE) live ONLY in env vars.
 *     They are never sent to the client and never logged.
 *  2. Every payload sent to eSewa is HMAC-SHA256 signed using the secret key.
 *  3. Every callback from eSewa is verified twice:
 *       a) the signature on the base64 payload is recomputed and compared
 *          with `crypto.timingSafeEqual` to prevent timing attacks
 *       b) we then call eSewa's transaction-status API server-to-server to
 *          confirm the payment is actually COMPLETE — we never trust the
 *          redirect alone
 *  4. The amount used in the signed payload is recomputed server-side before
 *     initiation and never taken from the client request body.
 *  5. `transaction_uuid` is a server-generated random UUID. It is unique per
 *     attempt and acts as the idempotency key, preventing replay attacks.
 *  6. The signed_field_names list is fixed; we never let the client choose
 *     which fields are included in the signature.
 */

// ── Configuration (lazy so tests can override env) ────────────────────────
function getConfig() {
  const productCode = process.env.ESEWA_PRODUCT_CODE;
  const secretKey = process.env.ESEWA_SECRET_KEY;
  const baseUrl = process.env.ESEWA_BASE_URL || "https://rc-epay.esewa.com.np";

  if (!productCode || !secretKey) {
    throw new Error(
      "eSewa is not configured: ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY env vars are required"
    );
  }

  return { productCode, secretKey, baseUrl };
}

// ── HMAC signing ──────────────────────────────────────────────────────────

/**
 * Compute eSewa's HMAC-SHA256 signature over a `key=value,key=value` string.
 * Returns base64 — exactly what eSewa expects.
 */
function sign(message, secretKey) {
  return crypto
    .createHmac("sha256", secretKey)
    .update(message, "utf8")
    .digest("base64");
}

/**
 * Constant-time comparison of two base64 signatures.
 * Falls back to `false` (mismatch) on any length / encoding error so we never
 * leak information through exception messages.
 */
function safeCompareSignatures(a, b) {
  try {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a, "base64");
    const bufB = Buffer.from(b, "base64");
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ── Build initiation payload ──────────────────────────────────────────────

/**
 * Build the form data the customer's browser will POST to eSewa.
 *
 * IMPORTANT: `amount` MUST be the trusted server-side price. The caller is
 * responsible for recomputing it from the PickupRequest, NOT from req.body.
 */
export function buildEsewaInitiationPayload({ amount, pickupId }) {
  const { productCode, secretKey, baseUrl } = getConfig();

  // Whole-rupee amounts only — eSewa rejects fractional NPR for many merchants
  const totalAmount = Number(amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Invalid amount for eSewa payment");
  }

  // Random UUID — unique per attempt, prevents replay
  const transactionUuid = `MSKY-${pickupId}-${randomUUID()}`;

  // The exact field set we sign. Order matters — must match what we send.
  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const message =
    `total_amount=${totalAmount}` +
    `,transaction_uuid=${transactionUuid}` +
    `,product_code=${productCode}`;

  const signature = sign(message, secretKey);

  return {
    transactionUuid,
    actionUrl: `${baseUrl}/api/epay/main/v2/form`,
    formFields: {
      amount: String(totalAmount),
      tax_amount: "0",
      total_amount: String(totalAmount),
      transaction_uuid: transactionUuid,
      product_code: productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: `${process.env.BACKEND_URL}/api/payments/esewa/success`,
      failure_url: `${process.env.BACKEND_URL}/api/payments/esewa/failure`,
      signed_field_names: signedFieldNames,
      signature,
    },
  };
}

// ── Build billing initiation payload ─────────────────────────────────────

/**
 * Build the form data for a monthly billing payment via eSewa.
 * Same security model as pickup payments — amount from DB, server-signed.
 */
export function buildEsewaBillingPayload({ amount, billingId }) {
  const { productCode, secretKey, baseUrl } = getConfig();

  const totalAmount = Number(amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Invalid amount for eSewa billing payment");
  }

  const transactionUuid = `BILL-${billingId}-${randomUUID()}`;

  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const message =
    `total_amount=${totalAmount}` +
    `,transaction_uuid=${transactionUuid}` +
    `,product_code=${productCode}`;

  const signature = sign(message, secretKey);

  return {
    transactionUuid,
    actionUrl: `${baseUrl}/api/epay/main/v2/form`,
    formFields: {
      amount: String(totalAmount),
      tax_amount: "0",
      total_amount: String(totalAmount),
      transaction_uuid: transactionUuid,
      product_code: productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: `${process.env.BACKEND_URL}/api/billing/esewa/success`,
      failure_url: `${process.env.BACKEND_URL}/api/billing/esewa/failure`,
      signed_field_names: signedFieldNames,
      signature,
    },
  };
}

// ── Verify the signed callback payload ────────────────────────────────────

/**
 * eSewa redirects with `?data=<base64-json>`. The JSON contains the
 * transaction details and a `signature` field signed by eSewa with the same
 * shared secret. We must:
 *   1. Decode the base64 JSON
 *   2. Recompute the signature over the fields listed in `signed_field_names`
 *      using OUR copy of the secret key
 *   3. Compare in constant time
 *
 * Returns the parsed object on success or throws.
 */
export function decodeAndVerifyCallback(base64Data) {
  const { secretKey } = getConfig();

  if (!base64Data || typeof base64Data !== "string") {
    throw new Error("Missing eSewa callback data");
  }

  let parsed;
  try {
    const json = Buffer.from(base64Data, "base64").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Malformed eSewa callback payload");
  }

  const signedFieldNames = parsed.signed_field_names;
  const providedSignature = parsed.signature;

  if (!signedFieldNames || !providedSignature) {
    throw new Error("eSewa callback missing signature fields");
  }

  // Reconstruct the signed message exactly as eSewa specifies
  const fieldList = signedFieldNames.split(",");
  const message = fieldList
    .map((field) => `${field}=${parsed[field]}`)
    .join(",");

  const expectedSignature = sign(message, secretKey);

  if (!safeCompareSignatures(expectedSignature, providedSignature)) {
    throw new Error("eSewa callback signature mismatch");
  }

  return parsed;
}

// ── Server-to-server status verification ──────────────────────────────────

/**
 * After a successful redirect we MUST independently confirm with eSewa that
 * the transaction is actually COMPLETE. This is a server-to-server call so
 * the customer's browser cannot tamper with it.
 *
 * Returns the parsed response. The caller should require status === "COMPLETE"
 * AND total_amount === expectedAmount before crediting the payment.
 */
export async function verifyTransactionStatus({ transactionUuid, totalAmount }) {
  const { productCode, baseUrl } = getConfig();

  const url =
    `${baseUrl}/api/epay/transaction/status/` +
    `?product_code=${encodeURIComponent(productCode)}` +
    `&total_amount=${encodeURIComponent(totalAmount)}` +
    `&transaction_uuid=${encodeURIComponent(transactionUuid)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`eSewa status API returned HTTP ${res.status}`);
  }

  const data = await res.json();
  return data; // { product_code, transaction_uuid, total_amount, status, ref_id }
}
