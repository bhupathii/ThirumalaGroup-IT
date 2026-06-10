// Standalone validation script for CD Ledger Business Rules
// Run with: node scratch/validate_cd_rules.cjs

const assert = require('assert');

// 1. PENALTY / INTEREST SPLIT LOGIC
function computeRenewSplit(paymentAmount, penaltyDue) {
  if (penaltyDue > 0) {
    return {
      penaltyPaid: Number((paymentAmount * 0.20).toFixed(2)),
      interestPaid: Number((paymentAmount * 0.80).toFixed(2)),
      principalPaid: 0
    };
  } else {
    return {
      penaltyPaid: 0,
      interestPaid: Number(paymentAmount.toFixed(2)),
      principalPaid: 0
    };
  }
}

// 2. RENEWED DAYS LOGIC
function computeRenewedDays(principal, rate, interestPaid) {
  const monthlyInterest = principal * (rate / 100);
  return Math.max(0, Math.round((interestPaid / monthlyInterest) * 30));
}

// 3. NEXT DUE DATE LOGIC
function computeNextDueDate(paymentDateStr, renewedDays) {
  const baseDate = new Date(paymentDateStr + 'T12:00:00'); // Use noon to avoid timezone shift issues
  const nextDate = new Date(baseDate.getTime() + renewedDays * 24 * 60 * 60 * 1000);
  
  const y = nextDate.getFullYear();
  const m = String(nextDate.getMonth() + 1).padStart(2, '0');
  const d = String(nextDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let failures = 0;

function runTest(name, runFn) {
  console.log(`Running: ${name}`);
  try {
    runFn();
    console.log(`✅ PASS\n`);
  } catch (err) {
    console.error(`❌ FAIL: ${err.message}\n`);
    failures++;
  }
}

console.log("=== CD LEDGER BUSINESS RULES VALIDATION ===\n");

// Scenario 1: Penalty/Interest Split
runTest("Scenario 1.1: penaltyDue > 0 (100), paymentAmount = 1000", () => {
  const result = computeRenewSplit(1000, 100);
  console.log("Result:", result);
  assert.strictEqual(result.penaltyPaid, 200, "Penalty paid should be 20% of 1000 = 200");
  assert.strictEqual(result.interestPaid, 800, "Interest paid should be 80% of 1000 = 800");
});

runTest("Scenario 1.2: penaltyDue <= 0 (0), paymentAmount = 1000", () => {
  const result = computeRenewSplit(1000, 0);
  console.log("Result:", result);
  assert.strictEqual(result.penaltyPaid, 0, "Penalty paid should be 0");
  assert.strictEqual(result.interestPaid, 1000, "Interest paid should be 100% of 1000 = 1000");
});

// Scenario 2: Renewed Days Logic
runTest("Scenario 2.1: principal = 100000, rate = 3%, interestPaid = 3000", () => {
  const days = computeRenewedDays(100000, 3, 3000);
  console.log("Renewed Days:", days);
  assert.strictEqual(days, 30, "Renewed days should be 30");
});

runTest("Scenario 2.2: principal = 100000, rate = 3%, interestPaid = 1500", () => {
  const days = computeRenewedDays(100000, 3, 1500);
  console.log("Renewed Days:", days);
  assert.strictEqual(days, 15, "Renewed days should be 15");
});

// Scenario 3: Next Due Date Logic
runTest("Scenario 3.1: paymentDate = '2026-06-10', renewedDays = 30", () => {
  const nextDueDate = computeNextDueDate('2026-06-10', 30);
  console.log("Next Due Date:", nextDueDate);
  assert.strictEqual(nextDueDate, '2026-07-10', "Next due date should be 2026-07-10");
});

runTest("Scenario 3.2: paymentDate = '2026-06-10', renewedDays = 15", () => {
  const nextDueDate = computeNextDueDate('2026-06-10', 15);
  console.log("Next Due Date:", nextDueDate);
  assert.strictEqual(nextDueDate, '2026-06-25', "Next due date should be 2026-06-25");
});

console.log("=== SUMMARY ===");
if (failures === 0) {
  console.log("All 6 test scenarios passed successfully! 🎉");
  process.exit(0);
} else {
  console.error(`${failures} test scenario(s) failed.`);
  process.exit(1);
}
