(function() {
  let isPickerActive = false;
  let highlightedElement = null;
  let styleSheet = null;
  
  // 创建高亮样式
  function createHighlightStyle() {
    if (!styleSheet) {
      styleSheet = document.createElement('style');
      styleSheet.innerHTML = `
        .element-picker-highlight {
          outline: 2px dashed red !important;
          outline-offset: 1px !important;
          background-color: rgba(255, 0, 0, 0.2) !important;
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }
  
  // 获取元素的CSS选择器
  function getCssSelector(element) {
    if (!element) return '';
    if (element.id) return '#' + element.id;
    
    // 尝试使用class
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/);
      if (classes.length > 0) {
        return element.tagName.toLowerCase() + '.' + classes[0];
      }
    }
    
    // 使用标签名
    return element.tagName.toLowerCase();
  }
  
  // 应用规则屏蔽元素
  function applyBlockRules() {
    chrome.storage.local.get(['blockRules'], function(result) {
      const rules = result.blockRules || [];
      const currentUrl = window.location.href;
      
      // 找到匹配当前URL的规则
      const matchingRules = rules.filter(rule => {
        return currentUrl.includes(rule.urlPattern);
      });
      
      if (matchingRules.length > 0) {
        // 应用每条匹配的规则
        matchingRules.forEach(rule => {
          try {
            let selector = rule.elementSelector;
            
            // 检查是否是HTML标签格式 (如 <div class="example">)
            if (selector.trim().startsWith('<') && selector.includes('class=')) {
              // 提取标签名和class值
              const tagMatch = selector.match(/<(\w+)/);
              const classMatch = selector.match(/class=["']([^"']+)["']/);
              
              if (tagMatch && classMatch) {
                const tagName = tagMatch[1];
                const className = classMatch[1];
                // 转换为CSS选择器格式
                selector = `${tagName}.${className.replace(/\s+/g, '.')}`;
              }
            }
            
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
              element.style.display = 'none';
            });
          } catch (error) {
            console.error('无效的选择器:', rule.elementSelector, error);
          }
        });
      }
    });
  }
  
  // 激活元素选择器
  function activateElementPicker() {
    isPickerActive = true;
    createHighlightStyle();
    
    // 显示提示信息
    const infoBox = document.createElement('div');
    infoBox.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999999;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;
    infoBox.innerHTML = '点击要屏蔽的元素<br>ESC键取消';
    infoBox.id = 'element-picker-info';
    document.body.appendChild(infoBox);
    
    // 添加事件监听器
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
  }
  
  // 停用元素选择器
  function deactivateElementPicker() {
    isPickerActive = false;
    
    // 移除事件监听器
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKeyDown);
    
    // 移除高亮
    if (highlightedElement) {
      highlightedElement.classList.remove('element-picker-highlight');
      highlightedElement = null;
    }
    
    // 移除提示框
    const infoBox = document.getElementById('element-picker-info');
    if (infoBox) {
      infoBox.remove();
    }
  }
  
  // 鼠标悬停处理函数
  function handleMouseOver(e) {
    if (!isPickerActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 移除之前的高亮
    if (highlightedElement) {
      highlightedElement.classList.remove('element-picker-highlight');
    }
    
    // 高亮当前元素
    highlightedElement = e.target;
    highlightedElement.classList.add('element-picker-highlight');
  }
  
  // 鼠标移出处理函数
  function handleMouseOut(e) {
    if (!isPickerActive || !highlightedElement) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 移除高亮
    highlightedElement.classList.remove('element-picker-highlight');
  }
  
  // 点击处理函数
  function handleClick(e) {
    if (!isPickerActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 获取选择器
    const selector = getCssSelector(e.target);
    
    // 保存选择器到存储中
    chrome.storage.local.set({selectedElementSelector: selector}, function() {
      console.log('选择器已保存：', selector);
    });
    
    // 发送消息通知选择完成
    chrome.runtime.sendMessage({
      type: 'elementSelected',
      selector: selector
    });
    
    // 停用选择器
    deactivateElementPicker();
  }
  
  // 按键处理函数
  function handleKeyDown(e) {
    if (!isPickerActive) return;
    
    // ESC键取消选择
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      deactivateElementPicker();
    }
  }
  
  // 监听来自扩展的消息
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "activateElementPicker") {
      activateElementPicker();
    } else if (message.action === "reapplyRules") {
      applyBlockRules();
    }
  });
  
  // 初始加载时应用规则
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(applyBlockRules, 500); // 延迟执行以确保DOM完全加载
  });
  
  // 也在加载后立即执行一次，处理已经加载的页面
  applyBlockRules();
  
  // 监听动态内容变化
  const observer = new MutationObserver(function(mutations) {
    applyBlockRules();
  });
  
  // 配置和启动观察器
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();