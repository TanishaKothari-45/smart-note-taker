
let isRecording = false;
const output = document.getElementById("output");
const btn = document.getElementById("toggleBtn");

btn.addEventListener("click", async () => {
  if (!isRecording) {
    btn.textContent = "Stop Note";
    isRecording = true;

    chrome.runtime.sendMessage({ action: "start_capture" });
    output.textContent = "Listening... (transcription mocked)";
  } else {
    btn.textContent = "Start Note";
    isRecording = false;

    chrome.runtime.sendMessage({ action: "stop_capture" });
    output.textContent = "Transcription done!\n- This is a mock transcript.\n- Real one coming next!";
  }
});
