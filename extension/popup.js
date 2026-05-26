const DEFAULTS = {
  backendUrl: "http://localhost:3000",
  roomId: "",
  displayName: "",
  enabled: false,
  manualOffsetSeconds: 0
};

const $ = (id) => document.getElementById(id);

async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
  await sendToActiveTab({ type: "SSF_SETTINGS_UPDATED" });
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function load() {
  const settings = await getSettings();
  for (const [key, value] of Object.entries(settings)) {
    const el = $(key);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
  }
  const response = await sendToActiveTab({ type: "SSF_STATUS" });
  $("status").textContent = response?.status || response?.error || "Open a page with a video element.";
}

async function saveFromForm() {
  const settings = {
    backendUrl: $("backendUrl").value.trim().replace(/\/$/, ""),
    roomId: $("roomId").value.trim(),
    displayName: $("displayName").value.trim(),
    enabled: $("enabled").checked
  };
  await saveSettings(settings);
  $("status").textContent = "Saved.";
}

$("save").addEventListener("click", saveFromForm);
$("enabled").addEventListener("change", saveFromForm);
$("mark").addEventListener("click", async () => {
  await saveFromForm();
  const response = await sendToActiveTab({ type: "SSF_MARK_NOW" });
  $("status").textContent = response?.status || response?.error || "Marked.";
});
$("behind").addEventListener("click", async () => {
  const settings = await getSettings();
  await saveSettings({ manualOffsetSeconds: settings.manualOffsetSeconds - 1 });
  $("status").textContent = "Nudged back 1s.";
});
$("ahead").addEventListener("click", async () => {
  const settings = await getSettings();
  await saveSettings({ manualOffsetSeconds: settings.manualOffsetSeconds + 1 });
  $("status").textContent = "Nudged forward 1s.";
});

load();
