// Family Control - Main Script

// Family gateway token (isolated from dynasty gateway)
const FAMILY_TOKEN = 'a850ed2113157f15ec1be61784df6091db92777666faba8e';

const INSTANCES = {
  jaclyn: {
    url: 'https://jaclyn.singularity-labs.org',
    name: 'Jaclyn',
    role: 'Co-Parent AI',
    host: 'Beelink'
  },
  nicole: {
    url: 'https://nicole.singularity-labs.org',
    name: 'Nicole',
    role: 'Co-Parent AI',
    host: 'Beelink'
  },
  sarah: {
    url: 'https://sarah.singularity-labs.org',
    name: 'Sarah',
    role: 'Babysitter AI',
    host: 'Beelink'
  }
};

function getTokenizedUrl(instance) {
  return INSTANCES[instance].url + '/?token=' + FAMILY_TOKEN;
}

async function checkStatus(instance) {
  const statusItem = document.querySelector('.status-item[data-instance="' + instance + '"]');
  const mobileTab = document.querySelector('.mobile-tab[data-instance="' + instance + '"]');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(function() { controller.abort(); }, 5000);

    await fetch(INSTANCES[instance].url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (statusItem) statusItem.dataset.status = 'online';
    if (mobileTab) mobileTab.dataset.status = 'online';
  } catch (error) {
    var status = error.name === 'AbortError' ? 'offline' : 'online';
    if (statusItem) statusItem.dataset.status = status;
    if (mobileTab) mobileTab.dataset.status = status;
  }
}

function switchTab(instance) {
  document.querySelectorAll('.panel').forEach(function(panel) {
    panel.classList.remove('active');
  });
  var activePanel = document.querySelector('.panel[data-instance="' + instance + '"]');
  if (activePanel) activePanel.classList.add('active');

  document.querySelectorAll('.mobile-tab').forEach(function(tab) {
    tab.classList.remove('active');
  });
  var activeTab = document.querySelector('.mobile-tab[data-instance="' + instance + '"]');
  if (activeTab) activeTab.classList.add('active');
}

function refreshPanel(instance) {
  var frame = document.getElementById('frame-' + instance);
  var panel = frame.closest('.panel');

  panel.classList.add('loading');
  frame.src = getTokenizedUrl(instance);

  frame.onload = function() {
    panel.classList.remove('loading');
    checkStatus(instance);
  };
}

function refreshAll() {
  Object.keys(INSTANCES).forEach(function(instance) {
    refreshPanel(instance);
  });
}

function openExternal(instance) {
  window.open(INSTANCES[instance].url, '_blank');
}

document.addEventListener('DOMContentLoaded', function() {
  Object.keys(INSTANCES).forEach(function(instance) {
    var frame = document.getElementById('frame-' + instance);
    if (frame) {
      frame.src = getTokenizedUrl(instance);
    }
    checkStatus(instance);

    frame.onload = function() { checkStatus(instance); };
    frame.onerror = function() {
      var statusItem = document.querySelector('.status-item[data-instance="' + instance + '"]');
      var mobileTab = document.querySelector('.mobile-tab[data-instance="' + instance + '"]');
      if (statusItem) statusItem.dataset.status = 'offline';
      if (mobileTab) mobileTab.dataset.status = 'offline';
    };
  });

  if (window.innerWidth <= 900) {
    switchTab('jaclyn');
  }

  setInterval(function() {
    Object.keys(INSTANCES).forEach(function(instance) {
      checkStatus(instance);
    });
  }, 30000);
});

window.refreshPanel = refreshPanel;
window.refreshAll = refreshAll;
window.openExternal = openExternal;
window.switchTab = switchTab;
