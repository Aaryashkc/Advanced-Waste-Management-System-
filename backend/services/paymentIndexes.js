import Payment from "../models/Payment.model.js";

/**
 * Keep the eSewa transaction UUID unique without blocking cash payments.
 * Older cash rows may have transactionUuid:null, which collides with a normal
 * unique index. Cash payments should not store this field at all.
 */
export async function ensurePaymentIndexes() {
  const collection = Payment.collection;

  const unsetResult = await collection.updateMany(
    { transactionUuid: { $type: 10 } },
    { $unset: { transactionUuid: "" } }
  );

  if (unsetResult.modifiedCount > 0) {
    console.log(`[PaymentIndexes] Unset transactionUuid on ${unsetResult.modifiedCount} cash payment(s)`);
  }

  const indexes = await collection.indexes();
  const transactionIndex = indexes.find((index) => index.name === "transactionUuid_1");
  const hasPartialStringIndex =
    transactionIndex?.unique === true &&
    transactionIndex?.partialFilterExpression?.transactionUuid?.$type === "string";

  if (transactionIndex && !hasPartialStringIndex) {
    await collection.dropIndex(transactionIndex.name);
    console.log(`[PaymentIndexes] Dropped incompatible index: ${transactionIndex.name}`);
  }

  if (!hasPartialStringIndex) {
    await collection.createIndex(
      { transactionUuid: 1 },
      {
        unique: true,
        name: "transactionUuid_1",
        partialFilterExpression: { transactionUuid: { $type: "string" } },
      }
    );
    console.log("[PaymentIndexes] Ensured partial unique transactionUuid index");
  }
}
