// background.js — handles multiplayer peer signaling via localStorage polling
// (Uses a simple local relay; replace with WebSocket server for real multi-user)

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    tweetHistory: [],
    userHandle: '',
    friendHandle: '',
    friendFeed: [],
    multiplayerActive: false
  });
});

// Relay messages between popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_HISTORY') {
    chrome.storage.local.get(['tweetHistory'], (res) => {
      sendResponse(res.tweetHistory || []);
    });
    return true;
  }
  if (msg.type === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ tweetHistory: [] }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'SET_USER') {
    chrome.storage.local.set({ userHandle: msg.handle }, () => sendResponse({ ok: true }));
    return true;
  }
});
