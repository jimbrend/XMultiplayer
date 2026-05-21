// ============================================================
// 𝕏 History & Logo Replacer — content.js
// ============================================================

const LOGO_URL = chrome.runtime.getURL('logo.svg');
const DASHBOARD_URL = 'http://localhost:3000';

// ---- Logo Replacement ----
function createLogoImg() {
  const img = document.createElement('img');
  img.src = LOGO_URL;
  img.alt = '𝕏';
  img.style.cssText = `
    width: 0.9em; height: 0.9em;
    vertical-align: middle; display: inline-block;
    margin: 0 1px; cursor: pointer;
    transition: filter 0.2s, transform 0.15s;
  `;
  img.className = 'x-logo-replacer';
  img.dataset.animating = 'false';
  img.addEventListener('mouseenter', startLogoAnim);
  img.addEventListener('mouseleave', stopLogoAnim);
  img.addEventListener('click', logoClick);
  return img;
}

let _animFrame = null;
let _animStart = null;
function startLogoAnim(e) {
  const logo = e.currentTarget;
  logo.dataset.animating = 'true';
  logo.style.transform = 'scale(1.2)';
  const colors = [0, 60, 120, 180, 240, 300];
  let idx = 0;
  function tick() {
    if (logo.dataset.animating !== 'true') return;
    logo.style.filter = `hue-rotate(${colors[idx]}deg) brightness(1.3)`;
    idx = (idx + 1) % colors.length;
    logo._animTimer = setTimeout(tick, 130);
  }
  tick();
}
function stopLogoAnim(e) {
  const logo = e.currentTarget;
  logo.dataset.animating = 'false';
  clearTimeout(logo._animTimer);
  logo.style.filter = '';
  logo.style.transform = '';
}
function logoClick(e) {
  const logo = e.currentTarget;
  logo.style.filter = 'brightness(3)';
  logo.style.transform = 'scale(0.8) rotate(20deg)';
  setTimeout(() => {
    logo.style.filter = '';
    logo.style.transform = '';
  }, 400);
}

function replaceXInNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const text = node.textContent;
  if (!/X/.test(text)) return;
  const parent = node.parentNode;
  if (!parent) return;
  const tag = parent.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
  if (parent.classList.contains('x-logo-replacer')) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  const regex = /X/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    fragment.appendChild(createLogoImg());
    lastIndex = match.index + 1;
  }
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  parent.replaceChild(fragment, node);
}

function walkAndReplace(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(replaceXInNode);
}

// ---- Tweet History Tracking ----
const seenSet = new Set();

function extractTweetData(article) {
  try {
    const linkEl = article.querySelector('a[href*="/status/"]');
    if (!linkEl) return null;
    const href = linkEl.href;
    const idMatch = href.match(/\/status\/(\d+)/);
    if (!idMatch) return null;
    const id = idMatch[1];
    if (seenSet.has(id)) return null;

    const textEl = article.querySelector('[data-testid="tweetText"]');
    const authorEl = article.querySelector('[data-testid="User-Name"]');
    const avatarEl = article.querySelector('[data-testid="Tweet-User-Avatar"] img');
    const timeEl = article.querySelector('time');

    return {
      id,
      text: textEl?.innerText?.slice(0, 280) || '',
      author: authorEl?.innerText?.split('\n')[0] || '',
      handle: authorEl?.innerText?.split('\n')[1] || '',
      avatar: avatarEl?.src || '',
      timestamp: Date.now(),
      tweetTime: timeEl?.dateTime || '',
      url: `https://x.com/i/status/${id}`,
      liked: false,
      bookmarked: false,
    };
  } catch { return null; }
}

function saveTweet(data) {
  if (!data) return;
  seenSet.add(data.id);
  chrome.storage.local.get(['tweetHistory'], (res) => {
    const history = res.tweetHistory || [];
    history.unshift(data);
    const trimmed = history.slice(0, 2000);
    chrome.storage.local.set({ tweetHistory: trimmed });
    // Broadcast to dashboard via BroadcastChannel
    try {
      const bc = new BroadcastChannel('xhistory_channel');
      bc.postMessage({ type: 'NEW_TWEET', data });
      bc.close();
    } catch(e) {}
  });
}

// Check if liked or bookmarked in real time
function checkLikedBookmarked(article, tweetId) {
  const likeBtn = article.querySelector('[data-testid="like"]');
  const bookmarkBtn = article.querySelector('[data-testid="bookmark"]');
  const liked = likeBtn?.getAttribute('aria-pressed') === 'true';
  const bookmarked = bookmarkBtn?.getAttribute('aria-pressed') === 'true';
  if (liked || bookmarked) {
    chrome.storage.local.get(['tweetHistory'], (res) => {
      const history = res.tweetHistory || [];
      const idx = history.findIndex(t => t.id === tweetId);
      if (idx !== -1) {
        if (liked) history[idx].liked = true;
        if (bookmarked) history[idx].bookmarked = true;
        chrome.storage.local.set({ tweetHistory: history });
      }
    });
  }
}

// IntersectionObserver for seen tweets
const seenObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const article = entry.target;
    const data = extractTweetData(article);
    if (!data) return;
    // Mark seen after 600ms dwell
    article._seenTimer = setTimeout(() => {
      saveTweet(data);
      setTimeout(() => checkLikedBookmarked(article, data.id), 2000);
    }, 600);
  });
}, { threshold: 0.5 });

// Watch for new tweets in feed
const feedMutationObserver = new MutationObserver(() => {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
    if (!article.dataset.xTracked) {
      article.dataset.xTracked = '1';
      seenObserver.observe(article);
      walkAndReplace(article);
    }
  });
});

// Also track like/bookmark button interactions
document.addEventListener('click', (e) => {
  const likeBtn = e.target.closest('[data-testid="like"]');
  const bookmarkBtn = e.target.closest('[data-testid="bookmark"]');
  if (!likeBtn && !bookmarkBtn) return;
  const article = (likeBtn || bookmarkBtn).closest('article[data-testid="tweet"]');
  if (!article) return;
  const linkEl = article.querySelector('a[href*="/status/"]');
  if (!linkEl) return;
  const idMatch = linkEl.href.match(/\/status\/(\d+)/);
  if (!idMatch) return;
  const id = idMatch[1];

  setTimeout(() => {
    const liked = likeBtn?.getAttribute('aria-pressed') === 'true';
    const bookmarked = bookmarkBtn?.getAttribute('aria-pressed') === 'true';
    chrome.storage.local.get(['tweetHistory'], (res) => {
      const history = res.tweetHistory || [];
      const idx = history.findIndex(t => t.id === id);
      if (idx !== -1) {
        if (likeBtn) history[idx].liked = !history[idx].liked;
        if (bookmarkBtn) history[idx].bookmarked = !history[idx].bookmarked;
        chrome.storage.local.set({ tweetHistory: history });
      }
    });
  }, 300);
}, true);

// Init
function init() {
  walkAndReplace(document.body);
  feedMutationObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
    if (!article.dataset.xTracked) {
      article.dataset.xTracked = '1';
      seenObserver.observe(article);
    }
  });
}

init();

// Open dashboard from keyboard shortcut Alt+X (localhost, or extension helper tab)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'x') {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }, () => {
      if (chrome.runtime.lastError) {
        window.open(DASHBOARD_URL, '_blank');
      }
    });
  }
});
