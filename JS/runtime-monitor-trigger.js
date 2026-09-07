/**
 * WaterScope-AI visitor-triggered Hugging Face runtime monitor.
 *
 * Visitor opens Agent page
 *   -> Cloudflare Worker
 *   -> GitHub workflow_dispatch
 *   -> HF runtime monitoring workflow
 *
 * This script does not call the Hugging Face model API and does not
 * interfere with the Agent interface if the monitor trigger fails.
 */

(() => {
  "use strict";

  const RUNTIME_MONITOR_TRIGGER_URL =
    "https://waterscope-runtime-monitor.starfriend10.workers.dev/";

  // Avoid repeatedly triggering from the same browser during rapid refreshes.
  // The Cloudflare Worker also performs server-side deduplication/cooldown.
  const LOCAL_COOLDOWN_MS = 5 * 60 * 1000;
  const STORAGE_KEY = "waterscopeRuntimeMonitorLastTrigger";

  function recentlyTriggered() {
    try {
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      return Date.now() - last < LOCAL_COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  function markTriggered() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage errors; monitoring must never affect the Agent UI.
    }
  }

  async function triggerRuntimeMonitor() {
    if (recentlyTriggered()) {
      console.info(
        "[WaterScope runtime monitor] Local cooldown active; trigger skipped."
      );
      return;
    }

    // Mark before the request to prevent duplicate calls from rapid reloads.
    markTriggered();

    try {
      const response = await fetch(RUNTIME_MONITOR_TRIGGER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "waterscope-agent-page",
          page: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let result = null;
      try {
        result = await response.json();
      } catch {
        // A valid 2xx response without JSON is still acceptable here.
      }

      console.info(
        "[WaterScope runtime monitor] Trigger request completed.",
        result || ""
      );
    } catch (error) {
      console.warn(
        "[WaterScope runtime monitor] Trigger failed; Agent UI is unaffected.",
        error
      );

      // Allow a later refresh to retry if the request itself failed.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors.
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", triggerRuntimeMonitor, {
      once: true,
    });
  } else {
    triggerRuntimeMonitor();
  }
})();
