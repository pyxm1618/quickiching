// Shared puppeteer helpers for production browser gates.
//
// The gates drive real controls in React surfaces. Two failure modes made them
// flaky in CI: a click aimed at a control whose box is still animating (it
// misses), and a programmatic click issued before hydration (no React handler is
// attached yet, so nothing happens). Both helpers below remove those races.

const REACT_KEYS = /__(?:reactFiber|reactProps|reactContainer)/u;

function hasReactHandler(node) {
  return node instanceof Element && Object.keys(node).some((key) => REACT_KEYS.test(key));
}

/** Waits until a button carrying `text` is enabled and hydrated (React attached). */
export async function waitForHydratedButton(page, text, timeout = 15_000) {
  await page.waitForFunction((wanted) => {
    const node = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === wanted);
    return Boolean(node) && !node.disabled && Object.keys(node).some((key) => /__(?:reactFiber|reactProps|reactContainer)/u.test(key));
  }, { timeout }, text);
}

/** Clicks a button by exact trimmed text once its React handler is attached. */
export async function clickHydratedButton(page, text) {
  await waitForHydratedButton(page, text);
  const clicked = await page.evaluate((wanted) => {
    const node = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === wanted);
    if (!(node instanceof HTMLButtonElement) || node.disabled) return false;
    node.click();
    return true;
  }, text);
  return clicked;
}

/**
 * Clicks a control only after its box has settled, so an entrance animation
 * cannot move the target out from under the click.
 */
export async function clickSettled(page, selector) {
  const handle = await page.waitForSelector(selector, { visible: true, timeout: 15_000 });
  await handle.evaluate(async (node) => {
    node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    let previous = null;
    for (let index = 0; index < 45; index += 1) {
      const rect = node.getBoundingClientRect().toJSON();
      if (previous
        && Math.abs(rect.x - previous.x) < 1
        && Math.abs(rect.y - previous.y) < 1
        && Math.abs(rect.width - previous.width) < 1
        && Math.abs(rect.height - previous.height) < 1) return;
      previous = rect;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  await handle.click();
}

export { hasReactHandler };
