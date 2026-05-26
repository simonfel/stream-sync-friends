const SSF_DEFAULTS = {
  backendUrl: "http://localhost:3000",
  roomId: "",
  displayName: "",
  enabled: false,
  manualOffsetSeconds: 0
};

let state = {
  settings: SSF_DEFAULTS,
  participantId: null,
  lastSync: null,
  status: "Not connected.",
  interval: null,
  markEpochMs: null
};

function getVideo() {
  const videos = [...document.querySelectorAll("video")];
  return videos.find((video) => video.readyState > 0 && video.duration !== 0) || videos[0] || null;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadSettings() {
  state.settings = await chrome.storage.sync.get(SSF_DEFAULTS);
  const local = await chrome.storage.local.get({ participantId: null });
  state.participantId = local.participantId || uuid();
  await chrome.storage.local.set({ participantId: state.participantId });
}

function currentPayload(video) {
  return {
    participantId: state.participantId,
    displayName: state.settings.displayName || "Friend",
    mediaTimeSeconds: video.currentTime || 0,
    wallTimeMs: Date.now(),
    paused: video.paused,
    playbackRate: video.playbackRate || 1,
    manualOffsetSeconds: state.settings.manualOffsetSeconds || 0,
    href: location.href,
    markEpochMs: state.markEpochMs
  };
}

async function postState(payload) {
  const url = `${state.settings.backendUrl}/api/rooms/${encodeURIComponent(state.settings.roomId)}/state`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Backend ${response.status}`);
  return response.json();
}

function estimateLocalNow(video) {
  return video.currentTime + (video.paused ? 0 : 0.001 * 0 * video.playbackRate);
}

async function syncOnce() {
  if (!state.settings.enabled) {
    state.status = "Sync disabled.";
    return;
  }
  if (!state.settings.backendUrl || !state.settings.roomId) {
    state.status = "Set backend URL and room.";
    return;
  }
  const video = getVideo();
  if (!video) {
    state.status = "No video found on this page.";
    return;
  }

  const roomState = await postState(currentPayload(video));
  state.lastSync = roomState;

  if (!roomState.targetMediaTimeSeconds || video.seeking) {
    state.status = `Connected: ${roomState.participants?.length || 1} participant(s).`;
    return;
  }

  const target = roomState.targetMediaTimeSeconds + (state.settings.manualOffsetSeconds || 0);
  const delta = estimateLocalNow(video) - target;

  if (delta > 1.75) {
    video.pause();
    setTimeout(() => video.play().catch(() => {}), Math.min(delta * 1000, 30000));
    state.status = `Holding ${delta.toFixed(1)}s to align with room.`;
  } else if (delta > 0.35) {
    video.playbackRate = 0.97;
    state.status = `Trimming ${delta.toFixed(1)}s drift.`;
  } else if (delta < -1.5 && Number.isFinite(video.duration) && video.seekable?.length) {
    // If we're too far behind but DVR seek is available, try to catch up to the room target.
    const end = video.seekable.end(video.seekable.length - 1);
    video.currentTime = Math.min(target, end - 0.25);
    video.playbackRate = 1;
    state.status = `Seeking forward ${Math.abs(delta).toFixed(1)}s.`;
  } else if (delta < -0.35) {
    video.playbackRate = 1.03;
    state.status = `Catching up ${Math.abs(delta).toFixed(1)}s.`;
  } else {
    video.playbackRate = 1;
    state.status = `In sync (${delta.toFixed(1)}s). ${roomState.participants?.length || 1} in room.`;
  }
}

function startLoop() {
  if (state.interval) clearInterval(state.interval);
  state.interval = setInterval(() => {
    syncOnce().catch((error) => {
      state.status = error.message;
    });
  }, 1500);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "SSF_SETTINGS_UPDATED") {
      await loadSettings();
      await syncOnce().catch(() => {});
      sendResponse({ ok: true, status: state.status });
      return;
    }
    if (message.type === "SSF_STATUS") {
      sendResponse({ ok: true, status: state.status });
      return;
    }
    if (message.type === "SSF_MARK_NOW") {
      state.markEpochMs = Date.now();
      await syncOnce().catch(() => {});
      sendResponse({ ok: true, status: "Marked current moment for calibration." });
      return;
    }
  })();
  return true;
});

loadSettings().then(startLoop);
