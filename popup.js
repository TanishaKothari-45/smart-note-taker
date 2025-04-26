let port;
let ws;
let audioContext, processor, source;
let currentSession = null;
let allNotes = "";
let isWaitingForFinalTranscript = false;
let stopButtonClicked = false;
let sourceToDestination;
let stream;
let isCapturing = false;

document.getElementById("start").addEventListener("click", async () => {
  console.log("Starting capture...");

  if (isCapturing) {
    console.log("Capture session already active.");
    return;
  }
  try {
    console.log("stream starting..");

    if (ws && ws.readyState !== WebSocket.CLOSED) {
      console.log("Closing old WebSocket connection before starting new one");
      ws.close();
      ws = null;
    }

    stream = await new Promise((resolve, reject) => {
      console.log("tabcapture:", chrome.tabCapture);
      chrome.tabCapture.capture({ audio: true, video: false }, (capturedStream) => {
        console.log("capture stream ", capturedStream);
        if (chrome.runtime.lastError || !capturedStream) {
          reject(chrome.runtime.lastError?.message || "Stream is null");
        } else {
          console.log("resolve stream");
          resolve(capturedStream);
        }
      });
    });

    port = chrome.runtime.connect({ name: "gladia-live" });
    port.postMessage({ command: "start" });

    document.getElementById("start").disabled = true;
    document.getElementById("stop").disabled = false;

    await setupWebSocket();
    handleAudioStream(stream);
    isCapturing = true;

  } catch (err) {
    console.error("Error capturing tab:", err);
    alert("Could not capture tab audio. Try again on a normal webpage.");
  }
});

document.getElementById("stop").addEventListener("click", () => {
  stopCapture();
  port?.postMessage({ command: "stop" });
  saveSession(allNotes);
  updateSessionList();
  updateSessionCount();
  allNotes = "";
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.transcript) {
    if (!currentSession) {
      const sessionItem = document.createElement("li");
      sessionItem.className = "session";
      sessionItem.innerHTML = `<strong>Session:</strong> <div class="current-transcript"></div>`;
      document.getElementById("sessions").appendChild(sessionItem);
      currentSession = sessionItem.querySelector(".current-transcript");
    }
    currentSession.innerText += msg.transcript + " ";
    allNotes += msg.transcript + " ";
    document.getElementById("output").innerText = msg.transcript;
    scrollToBottom();
  }
});

async function setupWebSocket() {
  try {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      console.log("setupWebSocket: Closing old WebSocket connection first");

      await new Promise((resolve) => {
        ws.addEventListener('close', resolve);
        ws.close(1000);
      });

      ws = null;
    }

    const response = await fetch('https://api.gladia.io/v2/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gladia-Key': '53fXXXXXXX',
      },
      body: JSON.stringify({
        encoding: 'wav/pcm',
        sample_rate: 16000,
        bit_depth: 16,
        channels: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const { id, url } = await response.json();
    console.log("Received WebSocket URL:", url);

    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      console.log("WebSocket opened");
    });

    ws.addEventListener("message", function (event) {
      console.log("WebSocket message received");
      try {
        const message = JSON.parse(event.data.toString());
        console.log("message", message);
        if (message.type === 'transcript') {
          const output = document.getElementById("output");
          if (output) {
            output.innerText += message.data.utterance.text + "\n";
            allNotes += message.data.utterance.text + " ";
            scrollToBottom();
          }
        }
        else if (message.type === 'post_final_transcript') {
          console.log("Final transcript received, closing WebSocket");
          isWaitingForFinalTranscript = false;
          ws.close(1000);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    });

    ws.addEventListener("close", () => {
      console.log("WebSocket closed");
      if (stopButtonClicked && !isWaitingForFinalTranscript) {
        isCapturing = false;
        document.getElementById("start").disabled = false;
        document.getElementById("stop").disabled = true;
        document.getElementById("transcriptionCompleted").style.display = "block";
        stopButtonClicked = false;
      }
    });

  } catch (err) {
    console.error("WebSocket setup failed:", err);
    alert("Failed to initialize transcription: " + err.message);
  }
}

function handleAudioStream(stream) {
  console.log("handleAudioStream");

  audioContext = new AudioContext({ sampleRate: 16000 });
  source = audioContext.createMediaStreamSource(stream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  sourceToDestination = source.connect(audioContext.destination);

  source.connect(processor);
  processor.connect(audioContext.destination);
  source.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const pcm = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
      pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("sending audio chunk");
      const base64 = int16ToBase64(pcm);
      ws.send(JSON.stringify({
        type: "audio_chunk",
        data: { chunk: base64 },
      }));
    }
  };
}

function int16ToBase64(int16Array) {
  const byteArray = new Uint8Array(int16Array.buffer);
  let binary = "";
  for (let i = 0; i < byteArray.byteLength; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  return btoa(binary);
}

function stopCapture() {
  console.log("Stopping capture...");
  stopButtonClicked = true;

  if (!isCapturing) {
    console.log("No capture session active.");
    return;
  }

  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (sourceToDestination) {
    sourceToDestination.disconnect();
    sourceToDestination = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      console.log("Sending stop signal to WebSocket and closing");
      ws.send(JSON.stringify({
        type: "stop_recording",
      }));
    }
    ws = null;
  }
  if (stream) {
    console.log("Stopping all media tracks...");
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  if (port) {
    port.disconnect();
    port = null;
  }
}

function closeAllAudio() {
  if (sourceToDestination) {
    sourceToDestination.disconnect();
    sourceToDestination = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

document.getElementById("start").addEventListener("click", () => {
  document.getElementById("loader").style.display = "block";
  document.getElementById("recording-indicator").style.display = "block";
  document.getElementById("transcriptionCompleted").style.display = "none";
  currentSession = null;
});

document.getElementById("stop").addEventListener("click", () => {
  document.getElementById("loader").style.display = "none";
  document.getElementById("recording-indicator").style.display = "none";
});

document.getElementById("view-notes").addEventListener("click", () => {
  const sessions = getAllSessions();
  const newTab = window.open();
  newTab.document.write("<h1>All Transcriptions</h1>");
  sessions.forEach((session, index) => {
    newTab.document.write(`<h2>Session ${index + 1}</h2><p>${session.transcript}</p>`);
  });
});

window.addEventListener('beforeunload', () => {
  closeAllAudio();
  stopCapture();
});

function saveSession(transcript) {
  if (!transcript.trim()) return;
  const sessions = JSON.parse(localStorage.getItem("transcriptionSessions") || "[]");
  sessions.push({
    timestamp: new Date().toISOString(),
    transcript: transcript.trim()
  });
  localStorage.setItem("transcriptionSessions", JSON.stringify(sessions));
}


function getAllSessions() {
  return JSON.parse(localStorage.getItem("transcriptionSessions") || "[]");
}

function updateSessionList() {
  const sessions = getAllSessions();
  const sessionsList = document.getElementById("sessions");
  sessionsList.innerHTML = "";

  sessions.forEach((session, index) => {
    const sessionItem = document.createElement("li");
    sessionItem.className = "session";
    sessionItem.innerHTML = `<strong>Session ${index + 1}:</strong> ${session.transcript}`;
    sessionsList.appendChild(sessionItem);
  });
}

function updateSessionCount() {
  const sessions = JSON.parse(localStorage.getItem("transcriptionSessions") || "[]");
  const sessionCount = sessions.length + 1; // Including current session
  document.getElementById("session-count").innerText = `Session ${sessionCount}`;
}

document.addEventListener("DOMContentLoaded", () => {
  updateSessionCount();
});

function scrollToBottom() {
  const output = document.getElementById("output");
  output.scrollTop = output.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
  updateSessionList();
});

