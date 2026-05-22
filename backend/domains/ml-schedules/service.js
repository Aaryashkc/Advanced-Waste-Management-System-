import {
  checkMLHealth as checkMLHealthViaClient,
  generateSchedule as generateScheduleViaClient,
  getMLAreas as getMLAreasViaClient,
  predictArea as predictAreaViaClient,
} from "../../services/mlClient.js";

export async function predictArea(area, date, districtType = null, scaleFactor = 1.0) {
  return predictAreaViaClient(area, date, districtType, scaleFactor);
}

export async function generateSchedule(date, trucks = [], unavailableDrivers = [], extraAreas = []) {
  return generateScheduleViaClient(date, trucks, unavailableDrivers, extraAreas);
}

export async function getMLAreas() {
  return getMLAreasViaClient();
}

export async function checkMLHealth() {
  return checkMLHealthViaClient();
}
