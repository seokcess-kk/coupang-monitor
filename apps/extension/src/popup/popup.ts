const apiBaseUrlInput = document.getElementById("apiBaseUrl") as HTMLInputElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const toggleBtn = document.getElementById("toggleBtn") as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;

let isPolling = false;

// Load saved config
chrome.storage.local.get(["apiBaseUrl", "apiKey"], (data) => {
  if (data.apiBaseUrl) apiBaseUrlInput.value = data.apiBaseUrl;
  if (data.apiKey) apiKeyInput.value = data.apiKey;
});

// Check current status
chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
  if (response?.polling) {
    setActiveState();
  }
});

toggleBtn.addEventListener("click", () => {
  // Save config
  chrome.storage.local.set({
    apiBaseUrl: apiBaseUrlInput.value.trim() || "http://localhost:3000",
    apiKey: apiKeyInput.value.trim(),
  });

  if (isPolling) {
    chrome.runtime.sendMessage({ type: "STOP_POLLING" }, () => {
      setIdleState();
    });
  } else {
    chrome.runtime.sendMessage({ type: "START_POLLING" }, () => {
      setActiveState();
    });
  }
});

function setActiveState() {
  isPolling = true;
  toggleBtn.textContent = "Stop";
  toggleBtn.className = "btn-stop";
  statusDiv.textContent = "Polling...";
  statusDiv.className = "status active";
}

function setIdleState() {
  isPolling = false;
  toggleBtn.textContent = "Start";
  toggleBtn.className = "btn-start";
  statusDiv.textContent = "Idle";
  statusDiv.className = "status idle";
}
