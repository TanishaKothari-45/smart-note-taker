// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed and background ready.");
});

// (Optional) Handle messages if needed in the future
chrome.runtime.onConnect.addListener((port) => {
  console.log("Background connected to", port.name);

  port.onMessage.addListener((msg) => {
    console.log("Message received in background:", msg);
    // You can handle future logic here if needed
  });
});
