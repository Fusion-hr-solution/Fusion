// Carthage ids for the journey and screenshot scripts, read from the setup manifest so the scripts keep
// working after a rebuild (ids change with every rebuild; employee numbers and emails don't).
//   const { CYCLE, employee, plan } = require("./carthage-ids.cjs");
const path = require("path");

const manifest = require(path.join(__dirname, "carthage-demo.local.json"));

function employee(employeeNumber) {
  const id = manifest.employeeIds?.[employeeNumber];
  if (!id) throw new Error(`No employee ${employeeNumber} in carthage-demo.local.json; run prepare-carthage-demo.mjs first.`);
  return id;
}

function plan(employeeNumber) {
  const id = manifest.performance?.plans?.[employeeNumber]?.planId;
  if (!id) throw new Error(`No sample plan for ${employeeNumber} in carthage-demo.local.json.`);
  return id;
}

module.exports = {
  CYCLE: manifest.performance?.cycleId,
  TENANT: manifest.tenantId,
  employee,
  plan,
};
