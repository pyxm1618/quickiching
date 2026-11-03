export function evaluateRequiredGate(input) {
  const failed = [];
  if (input.select !== "success") failed.push("select");
  if (input.core !== "success") failed.push("core");

  const domain = (name, selected, result) => {
    if (selected) {
      if (result !== "success") failed.push(name);
      return;
    }
    if (!["success", "skipped"].includes(result)) failed.push(name);
  };

  domain("database", input.databaseSelected, input.database);
  domain("product", input.productSelected, input.product);
  domain("performance", input.performanceSelected, input.performance);

  return { ok: failed.length === 0, failed };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const bool = (value) => value === "true";
  const result = evaluateRequiredGate({
    select: process.env.SELECT_RESULT,
    core: process.env.CORE_RESULT,
    database: process.env.DATABASE_RESULT,
    product: process.env.PRODUCT_RESULT,
    performance: process.env.PERFORMANCE_RESULT,
    databaseSelected: bool(process.env.DATABASE_SELECTED),
    productSelected: bool(process.env.PRODUCT_SELECTED),
    performanceSelected: bool(process.env.PERFORMANCE_SELECTED),
  });
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
