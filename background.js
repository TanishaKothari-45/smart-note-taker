
let stream;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_capture") {
    chrome.tabCapture.capture({ audio: true, video: false }, function (s) {
      stream = s;
      console.log("Audio stream started.");
    });
  }

  if (request.action === "stop_capture") {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      console.log("Audio stream stopped.");
    }
  }
});
