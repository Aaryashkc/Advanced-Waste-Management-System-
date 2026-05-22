import { BadRequestError } from "./httpErrors.js";
import { validateCoordinates } from "./coordinateValidator.js";

export function requireFields(source, fields) {
  const missing = fields.filter((field) => source?.[field] === undefined || source?.[field] === null || source?.[field] === "");
  if (missing.length > 0) {
    throw new BadRequestError(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`, { missing });
  }
}

export function requireCoordinates(latitude, longitude, labels = {}) {
  const result = validateCoordinates(latitude, longitude, labels);
  if (!result.ok) {
    throw new BadRequestError(result.message);
  }
  return result.coordinates;
}
