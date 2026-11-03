import { connect } from "./client.js";

const panel = document.querySelector("#connection-panel");
const heading = document.querySelector("#connection-heading");
const detail = document.querySelector("#connection-detail");
const retry = document.querySelector("#connection-retry");
const badge = document.querySelector("#connection-state");
let started = false;
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty("--header-height", `${entry.target.getBoundingClientRect().height}px`);
  dispatchEvent(new Event("resize"));
}).observe(document.querySelector("header"));

async function start() {
  retry.disabled = true;
  retry.textContent = "Connecting…";
  badge.textContent = "Connecting…";
  heading.textContent = "Connecting to the Spark…";
  detail.textContent = "If your browser asks, allow access to your local network.";
  try {
    await connect();
    started = true;
    await import("./app.js?v=site-1");
    panel.hidden = true;
    badge.textContent = "Private Spark";
  } catch (error) {
    heading.textContent = started ? "The viewer could not start" : "The Spark is not connected";
    detail.textContent = started
      ? "Reload the viewer to try again, or open it directly on the Spark."
      : "Connect to your Tailscale network, then retry. Allow local-network access if your browser asks. You can also open the viewer directly on the Spark.";
    badge.textContent = "Disconnected";
    retry.textContent = started ? "Reload viewer" : "Retry connection";
    retry.disabled = false;
    console.error("Neuron Explorer startup:", error);
  }
}

retry.addEventListener("click", () => started ? location.reload() : start());
start();
