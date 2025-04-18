// 初始化扩展
chrome.runtime.onInstalled.addListener(function() {
  // 初始化存储
  chrome.storage.local.get(['blockRules'], function(result) {
    if (!result.blockRules) {
      chrome.storage.local.set({blockRules: []});
    }
  });
});

// 处理标签页切换
chrome.tabs.onActivated.addListener(function(activeInfo) {
  updateBadge(activeInfo.tabId);
});

// 处理URL更改
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    updateBadge(tabId);
  }
});

// 更新扩展图标上的徽章
function updateBadge(tabId) {
  chrome.tabs.get(tabId, function(tab) {
    if (tab && tab.url) {
      chrome.storage.local.get(['blockRules'], function(result) {
        const rules = result.blockRules || [];
        
        // 计算匹配当前URL的规则数量
        const matchCount = rules.filter(rule => tab.url.includes(rule.urlPattern)).length;
        
        // 更新徽章
        if (matchCount > 0) {
          chrome.browserAction.setBadgeText({text: matchCount.toString(), tabId: tabId});
          chrome.browserAction.setBadgeBackgroundColor({color: '#4285f4', tabId: tabId});
        } else {
          chrome.browserAction.setBadgeText({text: '', tabId: tabId});
        }
      });
    }
  });
}

// 处理来自content script的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'elementSelected') {
    // 不再尝试转发消息，因为popup可能已关闭
    // 此消息已在content.js中处理，保存到了storage
    console.log("元素已选择:", message.selector);
  }
});