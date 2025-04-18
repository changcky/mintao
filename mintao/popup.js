document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素引用
  const urlPatternInput = document.getElementById('urlPattern');
  const elementSelectorInput = document.getElementById('elementSelector');
  const addRuleButton = document.getElementById('addRule');
  const clearFieldsButton = document.getElementById('clearFields');
  const pickElementButton = document.getElementById('pickElement');
  const rulesListContainer = document.getElementById('rulesList');
  
  // 导入导出相关元素
  const importRulesButton = document.getElementById('importRules');
  const exportRulesButton = document.getElementById('exportRules');
  const importOptionsDiv = document.getElementById('importOptions');
  const importFileInput = document.getElementById('importFile');
  const importJsonTextarea = document.getElementById('importJsonText');
  const confirmImportButton = document.getElementById('confirmImport');
  const cancelImportButton = document.getElementById('cancelImport');
  
  // 加载已保存的规则
  loadRules();
  
  // 检查是否有已选择的元素
  chrome.storage.local.get(['selectedElementSelector'], function(result) {
    if (result.selectedElementSelector) {
      // 如果有已选择的元素，填充到选择器输入框
      elementSelectorInput.value = result.selectedElementSelector;
      
      // 使用后清除存储的选择器
      chrome.storage.local.remove('selectedElementSelector');
    }
  });
  
  // 按钮点击事件处理
  addRuleButton.addEventListener('click', addRule);
  clearFieldsButton.addEventListener('click', clearFields);
  pickElementButton.addEventListener('click', activateElementPicker);
  
  // 导入导出按钮事件
  importRulesButton.addEventListener('click', showImportOptions);
  exportRulesButton.addEventListener('click', exportRules);
  confirmImportButton.addEventListener('click', confirmImport);
  cancelImportButton.addEventListener('click', hideImportOptions);
  importFileInput.addEventListener('change', handleFileImport);
  
  // 从当前活动标签页获取URL
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      urlPatternInput.value = tabs[0].url;
    }
  });
  
  // 监听来自content_script的消息
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'elementSelected') {
      elementSelectorInput.value = message.selector;
    }
  });

  // 添加规则函数
  function addRule() {
    const urlPattern = urlPatternInput.value.trim();
    const elementSelector = elementSelectorInput.value.trim();
    
    if (!urlPattern || !elementSelector) {
      alert('请输入URL模式和元素选择器！');
      return;
    }
    
    // 获取已保存的规则
    chrome.storage.local.get(['blockRules'], function(result) {
      const rules = result.blockRules || [];
      
      // 检查是否处于编辑模式
      const editingRuleId = urlPatternInput.dataset.editingRuleId;
      
      if (editingRuleId) {
        // 更新现有规则
        const ruleIndex = rules.findIndex(rule => rule.id === editingRuleId);
        if (ruleIndex !== -1) {
          rules[ruleIndex].urlPattern = urlPattern;
          rules[ruleIndex].elementSelector = elementSelector;
        }
      } else {
        // 检查是否已存在相同规则
        const exists = rules.some(rule => 
          rule.urlPattern === urlPattern && rule.elementSelector === elementSelector
        );
        
        if (exists) {
          alert('此规则已存在！');
          return;
        }
        
        // 添加新规则
        rules.push({
          id: Date.now().toString(),
          urlPattern: urlPattern,
          elementSelector: elementSelector
        });
      }
      
      // 保存规则
      chrome.storage.local.set({blockRules: rules}, function() {
        // 重新加载规则列表
        loadRules();
        // 清空输入字段
        clearFields();
        // 恢复添加按钮文本
        addRuleButton.textContent = '添加规则';
        // 移除编辑状态
        delete urlPatternInput.dataset.editingRuleId;
        // 移除取消按钮
        const cancelButton = document.getElementById('cancelEdit');
        if (cancelButton) {
          cancelButton.remove();
        }
        // 通知当前页面重新应用规则
        notifyContentScript();
      });
    });
  }
  
  // 编辑规则函数
  function editRule(rule) {
    // 填充表单字段
    urlPatternInput.value = rule.urlPattern;
    elementSelectorInput.value = rule.elementSelector;
    
    // 保存当前编辑的规则ID
    urlPatternInput.dataset.editingRuleId = rule.id;
    
    // 修改添加按钮文本
    addRuleButton.textContent = '保存修改';
    
    // 添加取消编辑按钮
    if (!document.getElementById('cancelEdit')) {
      const cancelButton = document.createElement('button');
      cancelButton.id = 'cancelEdit';
      cancelButton.textContent = '取消编辑';
      cancelButton.addEventListener('click', cancelEditing);
      document.querySelector('.form-buttons').appendChild(cancelButton);
    }
  }
  
  // 取消编辑模式
  function cancelEditing() {
    // 清除表单
    clearFields();
    
    // 恢复添加按钮文本
    addRuleButton.textContent = '添加规则';
    
    // 移除编辑状态
    delete urlPatternInput.dataset.editingRuleId;
    
    // 移除取消按钮
    const cancelButton = document.getElementById('cancelEdit');
    if (cancelButton) {
      cancelButton.remove();
    }
  }
  
  // 删除规则函数
  function deleteRule(ruleId) {
    chrome.storage.local.get(['blockRules'], function(result) {
      const rules = result.blockRules || [];
      const newRules = rules.filter(rule => rule.id !== ruleId);
      
      chrome.storage.local.set({blockRules: newRules}, function() {
        // 重新加载规则列表
        loadRules();
        // 通知当前页面重新应用规则
        notifyContentScript();
      });
    });
  }
  
  // 加载规则列表函数
  function loadRules() {
    chrome.storage.local.get(['blockRules'], function(result) {
      const rules = result.blockRules || [];
      
      // 清空现有规则列表
      rulesListContainer.innerHTML = '';
      
      if (rules.length === 0) {
        rulesListContainer.innerHTML = '<p>还没有添加任何规则</p>';
        return;
      }
      
      // 添加每条规则到列表
      rules.forEach(rule => {
        const ruleItem = document.createElement('div');
        ruleItem.className = 'rule-item';
        
        const ruleInfo = document.createElement('div');
        ruleInfo.className = 'rule-info';
        
        const urlDiv = document.createElement('div');
        urlDiv.className = 'rule-url';
        urlDiv.textContent = rule.urlPattern;
        
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'rule-selector';
        selectorDiv.textContent = rule.elementSelector;
        
        ruleInfo.appendChild(urlDiv);
        ruleInfo.appendChild(selectorDiv);
        
        const actionDiv = document.createElement('div');
        actionDiv.className = 'rule-actions';
        
        // 添加编辑按钮
        const editButton = document.createElement('button');
        editButton.textContent = '编辑';
        editButton.className = 'edit-button';
        editButton.addEventListener('click', function() {
          editRule(rule);
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', function() {
          deleteRule(rule.id);
        });
        
        actionDiv.appendChild(editButton);
        actionDiv.appendChild(deleteButton);
        
        ruleItem.appendChild(ruleInfo);
        ruleItem.appendChild(actionDiv);
        
        rulesListContainer.appendChild(ruleItem);
      });
    });
  }
  
  // 清空输入字段函数
  function clearFields() {
    urlPatternInput.value = '';
    elementSelectorInput.value = '';
  }
  
  // 激活元素选择器函数
  function activateElementPicker() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "activateElementPicker"});
      window.close(); // 关闭弹出窗口以便用户选择元素
    });
  }
  
  // 通知内容脚本重新应用规则
  function notifyContentScript() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "reapplyRules"});
    });
  }
  
  // 显示导入选项
  function showImportOptions() {
    importOptionsDiv.classList.remove('hidden');
  }
  
  // 隐藏导入选项
  function hideImportOptions() {
    importOptionsDiv.classList.add('hidden');
    importFileInput.value = '';
    importJsonTextarea.value = '';
  }
  
  // 导出规则
  function exportRules() {
    chrome.storage.local.get(['blockRules'], function(result) {
      const rules = result.blockRules || [];
      
      if (rules.length === 0) {
        alert('没有可导出的规则！');
        return;
      }
      
      // 创建要导出的对象
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        rules: rules
      };
      
      // 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // 创建Blob对象
      const blob = new Blob([jsonString], {type: 'application/json'});
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'element-blocker-rules-' + new Date().toISOString().slice(0, 10) + '.json';
      
      // 触发下载
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    });
  }
  
  // 处理文件导入
  function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      importJsonTextarea.value = event.target.result;
    };
    reader.readAsText(file);
  }
  
  // 确认导入规则
  function confirmImport() {
    const jsonText = importJsonTextarea.value.trim();
    
    if (!jsonText) {
      alert('请选择文件或输入JSON数据！');
      return;
    }
    
    try {
      // 解析JSON
      const importData = JSON.parse(jsonText);
      
      // 验证导入数据格式
      if (!importData.rules || !Array.isArray(importData.rules)) {
        throw new Error('无效的规则数据格式');
      }
      
      // 验证每条规则
      importData.rules.forEach(rule => {
        if (!rule.urlPattern || !rule.elementSelector) {
          throw new Error('规则数据不完整');
        }
      });
      
      // 获取现有规则
      chrome.storage.local.get(['blockRules'], function(result) {
        const existingRules = result.blockRules || [];
        
        // 合并规则，确保ID唯一
        const combinedRules = [...existingRules];
        
        importData.rules.forEach(importedRule => {
          // 检查是否已存在相同规则
          const exists = combinedRules.some(rule => 
            rule.urlPattern === importedRule.urlPattern && 
            rule.elementSelector === importedRule.elementSelector
          );
          
          if (!exists) {
            // 添加新的唯一ID
            combinedRules.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              urlPattern: importedRule.urlPattern,
              elementSelector: importedRule.elementSelector
            });
          }
        });
        
        // 保存合并后的规则
        chrome.storage.local.set({blockRules: combinedRules}, function() {
          // 重新加载规则列表
          loadRules();
          // 隐藏导入选项
          hideImportOptions();
          // 显示导入成功信息
          const importedCount = combinedRules.length - existingRules.length;
          alert(`成功导入 ${importedCount} 条规则 (忽略了 ${importData.rules.length - importedCount} 条重复规则)`);
          // 通知当前页面重新应用规则
          notifyContentScript();
        });
      });
      
    } catch (error) {
      alert('导入失败: ' + error.message);
    }
  }
});