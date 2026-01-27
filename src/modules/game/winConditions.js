export const WinConditionTypes = {
  STDOUT: "stdout",
  STDERR: "stderr",
};

export function evaluateWinCondition(condition, output) {
  if (!condition) return false;
  const { type, mode, expected } = condition;
  const target = type === WinConditionTypes.STDERR ? "stderr" : "stdout";
  const payload = output ?? "";
  if (mode === "exact") {
    return payload.trim() === expected.trim();
  }
  if (mode === "contains") {
    return payload.includes(expected);
  }
  if (mode === "regex") {
    return new RegExp(expected, "i").test(payload);
  }
  return false;
}
