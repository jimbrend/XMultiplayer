// dashboard-bridge.js — sync extension storage → localhost dashboard
(function () {
  if (!chrome?.storage?.local) return;

  function pushHistory(history) {
    const list = Array.isArray(history) ? history : [];
    try {
      localStorage.setItem('xhistory_tweets', JSON.stringify(list));
    } catch (e) {}
    window.dispatchEvent(
      new CustomEvent('xhistory-extension-sync', { detail: list })
    );
  }

  function pullFromStorage() {
    chrome.storage.local.get(['tweetHistory'], (res) => {
      pushHistory(res.tweetHistory || []);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.tweetHistory) {
      pushHistory(changes.tweetHistory.newValue || []);
    }
  });

  window.addEventListener('xhistory-request-sync', pullFromStorage);

  window.__XHISTORY_BRIDGE__ = true;
  pullFromStorage();
})();
