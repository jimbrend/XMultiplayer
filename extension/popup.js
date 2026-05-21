chrome.storage.local.get(['tweetHistory'], (res) => {
  const history = res.tweetHistory || [];
  document.getElementById('seenCount').textContent = history.length;
  document.getElementById('likedCount').textContent = history.filter(t => t.liked).length;
  document.getElementById('bookmarkCount').textContent = history.filter(t => t.bookmarked).length;
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear all history?')) {
    chrome.storage.local.set({ tweetHistory: [] }, () => window.close());
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get(['tweetHistory'], (res) => {
    const blob = new Blob([JSON.stringify(res.tweetHistory || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'x-multiplayer-history.json';
    a.click();
  });
});
