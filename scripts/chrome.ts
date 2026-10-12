// System Chrome, launched one way for every script of the site that opens a browser: the example
// thumbnails, the first-load measurement and the Install page proof. Playwright finds it by its
// channel on Windows, macOS or Linux, so no path is written here; a machine without Chrome gets
// Playwright's error, which names what is missing. Never Playwright's own headless shell: it
// composites a WebGPU canvas it cannot read, and the device is lost right after the first frame.
// The engine's bench launches Chrome the same way (its `bench/runner/harness/chrome.ts`).
import { chromium, type LaunchOptions } from 'playwright'

/** Throws when Chrome would start under `node --test`: no test of the site opens a browser. */
function assertNoTestRun() {
  if (process.env.NODE_TEST_CONTEXT || process.execArgv.includes('--test'))
    throw new Error('Chrome refused: no test opens a browser.')
}

/** Launches system Chrome with the options of `chromium.launch`; the channel is set here alone. */
export async function launchChrome(options: LaunchOptions = {}) {
  assertNoTestRun()
  return chromium.launch({ ...options, channel: 'chrome', executablePath: undefined })
}
