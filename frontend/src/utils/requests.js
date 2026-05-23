export function isAbortError(error) {
  return error?.name === "CanceledError" || error?.code === "ERR_CANCELED";
}
