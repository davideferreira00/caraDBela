    let deviceQueue = [];
    let deviceTypes = [];
    let currentDevice = null;
    const addedDevices = [];
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const knownMacs = new Set();
    const deviceMap = new Map();
    const username = localStorage.getItem('username') || 'U';
    const userIcon = document.getElementById('user-icon');
    const dropdown = document.getElementById('user-dropdown');
    const loginBtn = document.getElementById('login-btn');
    
    const iconEl = document.getElementById('user-icon');
    if (iconEl) {
    iconEl.innerText = username.charAt(0).toUpperCase();
    }

    if (userIcon) {
    userIcon.onclick = () => {
        window.location.href = 'profile.html';
    };
    }

    const whitelistTabBtn = document.getElementById('whitelistTabBtn');
    if (whitelistTabBtn) {
    whitelistTabBtn.addEventListener('click', () => {
      document.getElementById('whitelistTabBtn').classList.add('active');
      document.getElementById('networkTabBtn').classList.remove('active');
      document.getElementById('securityTabBtn').classList.remove('active');
      document.getElementById('whitelistTab').classList.add('active');
      document.getElementById('networkTab').classList.remove('active');
      document.getElementById('securityTab').classList.remove('active');
      
      loadWhitelistData();
    });
    }

async function addDeviceFromModal() {
  const name = document.getElementById('device-name').value.trim();
  const typeId = document.getElementById('device-type').value;
  
  if (!name) {
    showNotification('Por favor, ponha um nome para o dispositivo.', 'error');
    return;
  }

  const newDevice = {
    ip: currentDevice.ip,
    mac: currentDevice.mac,
    name,
    type: typeId || null,
    ssid: currentDevice.ssid,
    userId: localStorage.getItem('userId')
  };

  try {
    const response = await fetch('/add-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(newDevice)
    });
    
    if (!response.ok) throw new Error('Falha ao adicionar dispositivo');
    
    const addedDevice = await response.json();
    deviceMap.set(addedDevice.mac, addedDevice);
    addedDevices.push(addedDevice);

    if (currentDevice.mac && currentDevice.mac !== 'Desconhecido') {
      knownMacs.add(currentDevice.mac);
    }
    
    showNotification('Dispositivo adicionado com sucesso!', 'info');
    closeModal();
    showNextDevice();
  } catch (err) {
    showNotification('Erro ao adicionar dispositivo: ' + err.message, 'error');
    showNextDevice();
  }
}

function closeModal() {
  document.getElementById('add-device-modal').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'none';
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

    function changeDeviceType(deviceId, deviceDiv) {
      const typeSelect = document.createElement('select');
      typeSelect.innerHTML = '<option value="">Remover tipo</option>' +
        deviceTypes.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
      
      typeSelect.onchange = () => {
        const selectedType = typeSelect.value;

        fetch(`/update-device-type/${deviceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ type: selectedType || null })
        })
        .then(res => {
          if (!res.ok) throw new Error('Erro ao atualizar tipo de dispositivo.');
          return res.json();
        })
        .then(data => {
          const updatedDevice = deviceMap.get(data.mac);
          if (updatedDevice) {
            updatedDevice.type = deviceTypes.find(t => t._id === selectedType) || null;
          }
          displayResults();
        })
        .catch(err => alert(err.message));
      };

      deviceDiv.appendChild(typeSelect);
    }

 function addDeviceCard(device) {
  const container = document.getElementById('scanResults');
  
  if (container.querySelector('.empty-state')) {
    container.innerHTML = '';
  }

  if (!container.querySelector('.devices-table-container')) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'devices-table-container';
    
    const table = document.createElement('table');
    table.className = 'devices-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Nome</th>
        <th>IP</th>
        <th>MAC</th>
        <th>Rede</th>
        <th>Tipo</th>
        <th>Ações</th>
      </tr>
    `;
    
    const tbody = document.createElement('tbody');
    
    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);
  }

  const tbody = container.querySelector('tbody');
  const typeName = (device.type && device.type.name) ? device.type.name : 'Não especificado';
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${device.name}</td>
    <td>${device.ip}</td>
    <td>${device.mac}</td>
    <td>${device.ssid || 'Desconhecida'}</td>
    <td>${typeName}</td>
    <td>
      <div class="device-actions">
        <button class="device-action-btn change-type-btn" title="Alterar tipo">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="device-action-btn delete-btn" title="Eliminar dispositivo">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </td>
  `;
  
  row.querySelector('.delete-btn').addEventListener('click', () => {
    deleteDevice(device._id, row);
  });

  row.querySelector('.change-type-btn').addEventListener('click', () => {
    showTypeSelector(device._id, row);
  });
  
  tbody.appendChild(row);
}

  function showTypeSelector(deviceId, deviceDiv) {
  const device = addedDevices.find(d => d._id === deviceId);
  if (!device) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
  overlay.style.zIndex = '1000';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  
  const selector = document.createElement('div');
  selector.className = 'type-selector';
  selector.style.background = 'var(--ocean-blue)';
  selector.style.padding = '2rem';
  selector.style.borderRadius = '10px';
  selector.style.width = '400px';
  selector.style.maxWidth = '90%';
  
  selector.innerHTML = `
    <h3 style="margin-bottom: 1rem; color: var(--light-wave);">Alterar Tipo do Dispositivo</h3>
    <select class="type-select" style="width: 100%; padding: 0.8rem; margin-bottom: 1.5rem; background: rgba(40, 40, 60, 0.6); color: var(--text-light); border: 1px solid #5f5e99; border-radius: 5px;">
      <option value="">Selecione um tipo</option>
      ${deviceTypes.map(t => `<option value="${t._id}" ${device.type && device.type._id === t._id ? 'selected' : ''}>${t.name}</option>`).join('')}
    </select>
    <div style="display: flex; justify-content: flex-end; gap: 0.8rem;">
      <button class="btn" style="background: var(--coral);">Cancelar</button>
      <button class="btn btn-primary">Confirmar</button>
    </div>
  `;
  
  overlay.appendChild(selector);
  document.body.appendChild(overlay);
  
  selector.querySelector('.btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  selector.querySelector('.btn-primary').addEventListener('click', () => {
    const selectedType = selector.querySelector('.type-select').value;
    updateDeviceType(deviceId, selectedType, deviceDiv);
    document.body.removeChild(overlay);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

function updateDeviceType(deviceId, typeId, deviceDiv) {
  fetch(`/update-device-type/${deviceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ type: typeId || null })
  })
  .then(res => {
    if (!res.ok) throw new Error('Erro ao atualizar tipo de dispositivo');
    return res.json();
  })
  .then(updatedDevice => {
    const index = addedDevices.findIndex(d => d._id === deviceId);
    if (index !== -1) {
      addedDevices[index].type = deviceTypes.find(t => t._id === typeId) || null;
    }
    
    if (updatedDevice.mac) {
      deviceMap.set(updatedDevice.mac, updatedDevice);
    }
    
    displayResults();
  })
  .catch(err => {
    console.error('Erro ao atualizar tipo:', err);
    alert('Erro ao atualizar tipo: ' + err.message);
  });
}

    function updateDeviceType(deviceId, typeId, deviceDiv) {
      fetch(`/update-device-type/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ type: typeId || null })
      })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao atualizar tipo de dispositivo');
        return res.json();
      })
      .then(updatedDevice => {
        const index = addedDevices.findIndex(d => d._id === deviceId);
        if (index !== -1) {
          if (updatedDevice.type) {
            updatedDevice.type = deviceTypes.find(t => t._id === updatedDevice.type._id) || updatedDevice.type;
          }
          addedDevices[index] = updatedDevice;
        }
        
        const typeText = deviceDiv.querySelector('.device-type-text');
        typeText.textContent = updatedDevice.type ? updatedDevice.type.name : 'Não especificado';
        
        if (updatedDevice.mac) {
          deviceMap.set(updatedDevice.mac, updatedDevice);
        }
      })
      .catch(err => {
        console.error('Erro ao atualizar tipo:', err);
        alert('Erro ao atualizar tipo: ' + err.message);
      });
    }

function displayResults() {
  const tbody = document.getElementById('devicesTableBody');
  tbody.innerHTML = '';

  if (addedDevices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <i class="fas fa-plug"></i>
            <h3>Nenhum dispositivo encontrado</h3>
            <p>Clique em "Analisar Rede" para começar</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  addedDevices.forEach(device => {
    const typeName = device.type?.name || 'Não especificado';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="device-name">${device.name}</div>
        <div class="device-status">
          <span></span>
        </div>
      </td>
      <td>${device.ip}</td>
      <td>${device.mac}</td>
      <td>${device.ssid || 'Desconhecida'}</td>
      <td><span class="device-type-badge">${typeName}</span></td>
      <td>
        <div class="device-actions">
          <button class="device-action-btn edit-btn" title="Alterar tipo">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="device-action-btn delete-btn" title="Eliminar dispositivo">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    row.querySelector('.delete-btn').addEventListener('click', () => {
      deleteDevice(device._id, row);
    });

    row.querySelector('.edit-btn').addEventListener('click', () => {
      showTypeSelector(device._id, row);
    });
    
    tbody.appendChild(row);
  });
}

 function displaySecurityResults(data) {
  const container = document.getElementById('securityResults');
  container.innerHTML = '';
  
  if (!data || data.error) {
    container.innerHTML = `
      <div class="security-info warning">
        <h4><i class="fas fa-exclamation-triangle"></i> Erro na Análise</h4>
        <p>${data?.error || 'Nenhum resultado de segurança encontrado para este dispositivo.'}</p>
        <button class="btn btn-primary" onclick="runSecurityScan()">
          <i class="fas fa-redo"></i> Tentar Novamente
        </button>
      </div>
    `;
    return;
  }

  const host = data.host || {};
  const os = data.os || {};
  const ports = data.ports || [];
  const vulnerabilities = data.vulnerabilities || [];

  const criticalPorts = ports.filter(p => ['22', '21', '23', '3389', '5900'].includes(p.number)).length;
  const vulnCount = vulnerabilities.length;
  const highVulns = vulnerabilities.filter(v => v.is_exploit).length;

  let summaryHtml = `
    <div class="scan-summary">
      <div class="summary-card critical">
        <i class="fas fa-exclamation-triangle"></i>
        <div class="summary-count">${highVulns}</div>
        <div class="summary-label">Vulnerabilidades Críticas</div>
      </div>
      <div class="summary-card warning">
        <i class="fas fa-shield-virus"></i>
        <div class="summary-count">${vulnCount}</div>
        <div class="summary-label">Vulnerabilidades</div>
      </div>
      <div class="summary-card safe">
        <i class="fas fa-check-circle"></i>
        <div class="summary-count">${ports.length - criticalPorts}</div>
        <div class="summary-label">Portas Seguras</div>
      </div>
      <div class="summary-card">
        <i class="fas fa-network-wired"></i>
        <div class="summary-count">${ports.length}</div>
        <div class="summary-label">Portas Analisadas</div>
      </div>
    </div>
  `;
  
  container.innerHTML = summaryHtml;

  const hostInfo = document.createElement('div');
  hostInfo.className = 'security-info';
  hostInfo.innerHTML = `
    <h4><i class="fas fa-desktop"></i> Informações do Host</h4>
    ${host.ip ? `<p><strong>Endereço IP:</strong> ${host.ip}</p>` : ''}
    ${host.mac ? `<p><strong>Endereço MAC:</strong> ${host.mac}</p>` : ''}
    ${os.name ? `<p><strong>Sistema Operativo:</strong> ${os.name}</p>` : ''}
    ${os.accuracy ? `<p><strong>Precisão:</strong> ${os.accuracy}%</p>` : ''}
    ${host.hostname ? `<p><strong>Hostname:</strong> ${host.hostname}</p>` : ''}
  `;
  container.appendChild(hostInfo);
  
  if (ports.length > 0) {
    const portsSection = document.createElement('div');
    portsSection.className = 'security-info';
    
    let portsHtml = '<h4><i class="fas fa-door-open"></i> Portas Abertas</h4>';
    portsHtml += '<div class="table-responsive">';
    portsHtml += '<table class="ports-table">';
    portsHtml += '<thead><tr><th>Porta</th><th>Protocolo</th><th>Serviço</th><th>Versão</th><th>Estado</th><th>Risco</th></tr></thead><tbody>';
    
    ports.forEach(port => {
      const isCritical = ['22', '21', '23', '3389', '5900'].includes(port.number);
      const portClass = isCritical ? 'port-critical' : 
                       ['80', '443', '8080'].includes(port.number) ? 'port-warning' : 'port-safe';
      const riskLevel = isCritical ? 'Crítico' : 
                       ['80', '443', '8080'].includes(port.number) ? 'Médio' : 'Baixo';
      
      portsHtml += `
        <tr class="${portClass}">
          <td>${port.number}</td>
          <td>${port.protocol}</td>
          <td>${port.service || 'Desconhecido'}</td>
          <td>${port.version || '-'}</td>
          <td>${port.state}</td>
          <td><span class="severity-badge ${isCritical ? 'severity-high' : 'severity-medium'}">${riskLevel}</span></td>
        </tr>
      `;
    });
    
    portsHtml += '</tbody></table></div>';
    portsSection.innerHTML = portsHtml;
    container.appendChild(portsSection);
  } else {
    const noPorts = document.createElement('div');
    noPorts.className = 'security-info';
    noPorts.innerHTML = `
      <h4><i class="fas fa-door-closed"></i> Portas Abertas</h4>
      <p>Nenhuma porta aberta encontrada neste dispositivo.</p>
    `;
    container.appendChild(noPorts);
  }

  if (vulnerabilities.length > 0) {
    const vulnSection = document.createElement('div');
    vulnSection.className = 'security-info warning';
    
    let vulnHtml = '<h4><i class="fas fa-bug"></i> Vulnerabilidades Encontradas</h4>';
    vulnHtml += '<div class="vulnerabilities-list">';
    
    vulnerabilities.forEach(vuln => {
      const severity = vuln.is_exploit ? 'HIGH' : 'MEDIUM';
      const vulnClass = severity === 'HIGH' ? 'vulnerability-high' : 'vulnerability-medium';
      
      vulnHtml += `
        <div class="vulnerability ${vulnClass}">
          <p><strong>ID:</strong> ${vuln.id}</p>
          <p><strong>Tipo:</strong> ${vuln.type}</p>
          <p><strong>Severidade:</strong> <span class="severity-badge ${severity === 'HIGH' ? 'severity-high' : 'severity-medium'}">${severity}</span></p>
          <p><strong>Descrição:</strong> ${vuln.description}</p>
          ${vuln.solution ? `<p><strong>Solução:</strong> ${vuln.solution}</p>` : ''}
        </div>
      `;
    });
    
    vulnHtml += '</div>';
    vulnSection.innerHTML = vulnHtml;
    container.appendChild(vulnSection);
  } else {
    const noVuln = document.createElement('div');
    noVuln.className = 'security-info';
    noVuln.innerHTML = `
      <h4><i class="fas fa-check-circle"></i> Resultados da Análise</h4>
      <p style="color: var(--sea-green);">
        <i class="fas fa-thumbs-up"></i> Nenhuma vulnerabilidade crítica encontrada.
      </p>
      <p>O dispositivo parece seguro contra ameaças conhecidas.</p>
    `;
    container.appendChild(noVuln);
  }
}
    function deleteDevice(id, deviceDiv) {
      if (!id) return alert('ID do dispositivo inválido para eliminar.');
      fetch(`/delete-device/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(res => {
        if (!res.ok) throw new Error('Falha ao eliminar dispositivo');
        return res.json();
      })
      .then(() => {
        const index = addedDevices.findIndex(dev => dev._id === id);
        if (index !== -1) {
          addedDevices.splice(index, 1);
        }
        deviceDiv.remove();
      })
      .catch(err => alert(err.message));
    }

async function loadWhitelistData() {
  try {
    const userId = localStorage.getItem('userId');
    
    const [devicesResponse, whitelistResponse] = await Promise.all([
      fetch(`/get-devices/${userId}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      }),
      fetch('/whitelist', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
    ]);

    if (!devicesResponse.ok || !whitelistResponse.ok) {
      throw new Error('Erro ao carregar dados');
    }

    const regularDevices = await devicesResponse.json();
    const whitelistData = await whitelistResponse.json();
    
    const whitelistDevices = whitelistData.allowedMAC || [];

    const mainNetworkDevices = regularDevices.filter(device => {
      return !whitelistDevices.some(wlDevice => wlDevice.mac === device.mac);
    });

    document.getElementById('mainNetworkCount').textContent = `${mainNetworkDevices.length} dispositivo(s)`;
    document.getElementById('whitelistCount').textContent = `${whitelistDevices.length} dispositivo(s)`;

    renderDevices('userDevicesList', mainNetworkDevices, 'main');
    renderDevices('whitelistDevices', whitelistDevices, 'whitelist');
  } catch (error) {
    console.error('Erro na whitelist:', error);
    showNotification('Erro ao carregar dados da whitelist', 'error');
  }
}

function renderDevices(containerId, devices, networkType) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (devices.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-plug"></i>
        <h3>Nenhum dispositivo encontrado</h3>
        <p>Adicione dispositivos usando os botões na aba "Rede"</p>
      </div>`;
    return;
  }

  devices.forEach(device => {
    const card = document.createElement('div');
    card.className = 'device-card';
    
    const name = device.name || device.deviceName || 'Dispositivo sem nome';
    const ip = device.ip || 'IP desconhecido';
    const mac = device.mac || 'MAC desconhecido';
    const type = device.type?.name || device.deviceType?.name || 'Não especificado';

    card.innerHTML = `
      <div class="device-header">
        <i class="fas fa-laptop device-icon"></i>
        <div class="device-name">${name}</div>
        <span></span>
      </div>
      
      <div class="device-details">
        <div class="device-detail">
          <i class="fas fa-id-card"></i>
          <span>${mac}</span>
        </div>
        <div class="device-detail">
          <i class="fas fa-network-wired"></i>
          <span>${ip}</span>
        </div>
        <div class="device-detail">
          <i class="fas fa-tag"></i>
          <span>${type}</span>
        </div>
      </div>
      
      <div class="device-actions">
        ${getActionButtons(networkType, mac)}
      </div>
      
      <div class="network-status ${networkType === 'main' ? 'main' : networkType === 'whitelist' ? 'whitelist' : 'divided'}">
        ${networkType === 'main' ? 'Rede Principal' : networkType === 'whitelist' ? 'Whitelist' : 'Rede IoT'}
      </div>
    `;

    const actionButtons = card.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
      btn.addEventListener('click', () => handleWhitelistAction(btn.dataset.action, mac));
    });

    container.appendChild(card);
  });
}

function getActionButtons(networkType, mac) {
  switch(networkType) {
    case 'main':
      return `
        <button class="action-btn add-to-whitelist" data-action="addToWhitelist" data-mac="${mac}">
          <i class="fas fa-plus"></i> Whitelist
        </button>
      `;
    case 'whitelist':
      return `
        <button class="action-btn remove" data-action="remove" data-mac="${mac}">
          <i class="fas fa-trash"></i> Remover
        </button>
      `;
    default:
      return '';
  }
}

function handleWhitelistAction(action, mac) {
  switch(action) {
    case 'addToWhitelist':
      addToWhitelist(mac);
      break;
    case 'remove':
      removeFromWhitelist(mac);
      break;
    case 'moveToIoT':
      moveToIoT(mac);
      break;
  }
}

async function addToWhitelist(mac) {
  try {
    showNotification(`Adicionando dispositivo ${mac} à Whitelist...`, 'info');
    setTimeout(() => {
      showNotification(`Dispositivo ${mac} adicionado à Whitelist com sucesso!`, 'info');
      loadWhitelistData();
    }, 1000);
  } catch (error) {
    showNotification(`Erro ao adicionar à Whitelist: ${error.message}`, 'error');
  }
}

async function addToIoT(mac) {
  try {
    showNotification(`Movendo dispositivo ${mac} para Rede IoT...`, 'info');
    setTimeout(() => {
      showNotification(`Dispositivo ${mac} movido para Rede IoT com sucesso!`, 'info');
      loadWhitelistData();
    }, 1000);
  } catch (error) {
    showNotification(`Erro ao mover para IoT: ${error.message}`, 'error');
  }
}

async function removeFromWhitelist(mac) {
  if (!confirm(`Tem certeza que deseja remover o dispositivo ${mac} da Whitelist?`)) return;
  
  try {
    showNotification(`Removendo dispositivo ${mac} da Whitelist...`, 'info');
    setTimeout(() => {
      showNotification(`Dispositivo ${mac} removido da Whitelist com sucesso!`, 'info');
      loadWhitelistData();
    }, 1000);
  } catch (error) {
    showNotification(`Erro ao remover da Whitelist: ${error.message}`, 'error');
  }
}

async function moveToMain(mac) {
  try {
    showNotification(`Movendo dispositivo ${mac} para Rede Principal...`, 'info');
    setTimeout(() => {
      showNotification(`Dispositivo ${mac} movido para Rede Principal com sucesso!`, 'info');
      loadWhitelistData();
    }, 1000);
  } catch (error) {
    showNotification(`Erro ao mover para Rede Principal: ${error.message}`, 'error');
  }
}

async function moveToIoT(mac) {
  try {
    showNotification(`Movendo dispositivo ${mac} para Rede IoT...`, 'info');
    setTimeout(() => {
      showNotification(`Dispositivo ${mac} movido para Rede IoT com sucesso!`, 'info');
      loadWhitelistData();
    }, 1000);
  } catch (error) {
    showNotification(`Erro ao mover para IoT: ${error.message}`, 'error');
  }
}

async function moveToWhitelist(mac) {
  try {
    showNotification(`Movendo dispositivo ${mac} para Whitelist...`, 'info');
    setTimeout(() => {
      showNotification(`Dispositivo ${mac} movido para Whitelist com sucesso!`, 'info');
      loadWhitelistData();
    }, 1000);
  } catch (error) {
    showNotification(`Erro ao mover para Whitelist: ${error.message}`, 'error');
  }
}

document.getElementById('whitelistBeacon')?.addEventListener('click', loadWhitelistData);

function renderDevices(containerId, devices, networkType) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (devices.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-plug"></i>
        <h3>Nenhum dispositivo encontrado</h3>
        <p>Adicione dispositivos usando os botões na aba "Rede"</p>
      </div>`;
    return;
  }

  devices.forEach(device => {
    const card = document.createElement('div');
    card.className = 'device-card';
    
    const name = device.deviceName || device.name || 'Dispositivo sem nome';
    const ip = device.ip || 'IP desconhecido';
    const mac = device.mac || 'MAC desconhecido';
    const type = device.deviceType?.name || device.type?.name || 'Não especificado';

    card.innerHTML = `
      <div class="device-header">
        <i class="fas fa-laptop device-icon"></i>
        <div class="device-name">${name}</div>
        <span class="status-buoy online"></span>
      </div>
      
      <div class="device-details">
        <div class="device-detail">
          <i class="fas fa-id-card"></i>
          <span>${mac}</span>
        </div>
        <div class="device-detail">
          <i class="fas fa-network-wired"></i>
          <span>${ip}</span>
        </div>
        <div class="device-detail">
          <i class="fas fa-tag"></i>
          <span>${type}</span>
        </div>
      </div>
      
      <div class="device-actions">
        ${getActionButtons(networkType, mac)}
      </div>
      
      <div class="network-status ${networkType === 'main' ? 'main' : 'whitelist'}">
        ${networkType === 'main' ? 'Rede Principal' : 'Whitelist'}
      </div>
    `;

    card.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => handleWhitelistAction(btn.dataset.action, mac));
    });

    container.appendChild(card);
  });
}

function createWhitelistDeviceCard(device) {
  const card = document.createElement('div');
  card.className = 'whitelist-device-card';
  card.dataset.mac = device.mac;
  
  const typeName = device.deviceType?.name || device.type?.name || 'Não especificado';
  const isDivided = device.isInDividedNetwork;
  
  card.innerHTML = `
    <h3><i class="fas fa-network-wired device-type-icon"></i>${device.deviceName || device.name}</h3>
    <div class="device-meta">
      <span class="device-meta-item"><i class="fas fa-id-card"></i> ${device.mac}</span>
      <span class="device-meta-item"><i class="fas fa-tag"></i> ${typeName}</span>
    </div>
    <div class="network-status ${isDivided ? 'divided' : 'whitelist'}">
      ${isDivided ? 'Rede IoT Isolada' : 'Whitelist'}
    </div>
    <div class="whitelist-actions">
      <button class="remove-from-whitelist">
        <i class="fas fa-trash"></i> Remover
      </button>
      <button class="${isDivided ? 'move-to-main' : 'move-to-divided'}">
        <i class="fas ${isDivided ? 'fa-arrow-left' : 'fa-arrow-right'}"></i>
        ${isDivided ? 'Mover para Principal' : 'Mover para IoT'}
      </button>
    </div>
  `;
  
  card.querySelector('.remove-from-whitelist').addEventListener('click', () => {
    removeFromWhitelist(device.mac);
  });
  
  card.querySelector('.whitelist-actions button:last-child').addEventListener('click', () => {
    toggleDividedNetwork(device.mac, !isDivided);
  });
  
  return card;
}

async function addToWhitelist(device) {
  try {
    const response = await fetch('/whitelist/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        mac: device.mac,
        deviceName: device.name,
        deviceType: device.type ? device.type._id : null
      })
    });
    
    if (!response.ok) throw new Error('Falha ao adicionar à whitelist');
    
    showNotification('Dispositivo adicionado à Whitelist com sucesso!', 'info');
    loadWhitelistData();
  } catch (err) {
    console.error('Erro ao adicionar à whitelist:', err);
    showNotification('Erro ao adicionar à Whitelist: ' + err.message, 'error');
  }
}

async function removeFromWhitelist(mac) {
  if (!confirm('Tem certeza que deseja remover este dispositivo da Whitelist?')) return;
  
  try {
    const response = await fetch('/whitelist/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ mac })
    });
    
    if (!response.ok) throw new Error('Falha ao remover da whitelist');
    
    showNotification('Dispositivo removido da Whitelist com sucesso!', 'info');
    loadWhitelistData();
  } catch (err) {
    console.error('Erro ao remover da whitelist:', err);
    showNotification('Erro ao remover da Whitelist: ' + err.message, 'error');
  }
}

async function toggleDividedNetwork(mac, moveToDivided) {
  try {
    const response = await fetch('/whitelist/move-to-divided', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ mac })
    });
    
    if (!response.ok) throw new Error('Falha ao mover dispositivo');
    
    const action = moveToDivided ? 'movido para a Rede IoT' : 'movido para a Rede Principal';
    showNotification(`Dispositivo ${action} com sucesso!`, 'info');
    loadWhitelistData();
  } catch (err) {
    console.error('Erro ao mover dispositivo:', err);
    showNotification('Erro ao mover dispositivo: ' + err.message, 'error');
  }
}

function createDeviceCard(device, isInWhitelist) {
  const card = document.createElement('div');
  card.className = 'whitelist-device-card';
  card.dataset.mac = device.mac;
  
  const typeName = device.type ? device.type.name : 'Não especificado';
  
  card.innerHTML = `
    <p><strong>${device.name}</strong></p>
    <p>${device.mac}</p>
    <p>Tipo: ${typeName}</p>
    <div class="network-status main">Rede Principal</div>
  `;
  
  if (!isInWhitelist) {
    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-whitelist';
    addBtn.textContent = 'Adicionar à Whitelist';
    addBtn.onclick = () => addToWhitelist(device);
    card.appendChild(addBtn);
  }
  
  return card;
}

  function createWhitelistDeviceCard(whitelistDevice) {
  const card = document.createElement('div');
  card.className = 'whitelist-device-card';
  card.dataset.mac = whitelistDevice.mac;
  
  const typeName = whitelistDevice.deviceType ? whitelistDevice.deviceType.name : 'Não especificado';
  
  card.innerHTML = `
    <p><strong>${whitelistDevice.deviceName}</strong></p>
    <p>${whitelistDevice.mac}</p>
    <p>Tipo: ${typeName}</p>
    <div class="network-status ${whitelistDevice.isInDividedNetwork ? 'divided' : 'main'}">
      ${whitelistDevice.isInDividedNetwork ? 'Rede Dividida IoT' : 'Rede Principal'}
    </div>
    <button class="remove-from-whitelist">Remover da Whitelist</button>
    <button class="${whitelistDevice.isInDividedNetwork ? 'move-to-main' : 'move-to-divided'}">
      ${whitelistDevice.isInDividedNetwork ? 'Mover para Rede Principal' : 'Mover para Rede Dividida'}
    </button>
  `;
  
  card.querySelector('.remove-from-whitelist').onclick = () => removeFromWhitelist(whitelistDevice.mac);
  card.querySelector('button:last-child').onclick = () => toggleDividedNetwork(whitelistDevice.mac, !whitelistDevice.isInDividedNetwork);
  
  return card;
}

async function addToWhitelist(mac) {
  try {
    const device = deviceMap.get(mac);
    if (!device) {
      showNotification('Dispositivo não encontrado', 'error');
      return;
    }

    const response = await fetch('/whitelist/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        mac: mac,
        deviceName: device.name,
        deviceType: device.type ? device.type._id : null
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Falha ao adicionar à Whitelist');
    }

    showNotification(`Dispositivo ${device.name} adicionado à Whitelist com sucesso!`, 'info');
    loadWhitelistData();
    fetchDevices();
  } catch (error) {
    showNotification(`Erro ao adicionar à Whitelist: ${error.message}`, 'error');
  }
}

   async function removeFromWhitelist(mac) {
  if (!confirm(`Tem certeza que deseja remover o dispositivo ${mac} da Whitelist?`)) return;
  
  try {
    const response = await fetch('/whitelist/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ mac })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Falha ao remover da Whitelist');
    }

    showNotification(`Dispositivo ${mac} removido da Whitelist com sucesso!`, 'info');
    loadWhitelistData();
  } catch (error) {
    showNotification(`Erro ao remover da Whitelist: ${error.message}`, 'error');
  }
}

    async function toggleDividedNetwork(mac, moveToDivided) {
      try {
        const response = await fetch('/whitelist/move-to-divided', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ mac })
        });
        
        if (!response.ok) throw new Error('Falha ao mover dispositivo');
        
        loadWhitelistData();
      } catch (err) {
        console.error('Erro ao mover dispositivo:', err);
        alert('Erro ao mover dispositivo: ' + err.message);
      }
    }

   function showNextDevice() {
  if (deviceQueue.length === 0) {
    document.getElementById('add-device-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
    displayResults();
    return;
  }

  currentDevice = deviceQueue.shift();
  
  document.getElementById('device-ip').textContent = currentDevice.ip || 'Desconhecido';
  document.getElementById('device-mac').textContent = currentDevice.mac || 'Desconhecido';
  document.getElementById('device-ssid').textContent = currentDevice.ssid || 'Desconhecida';
  document.getElementById('device-name').value = currentDevice.name || '';
  
  document.getElementById('add-device-modal').style.display = 'block';
  document.getElementById('modal-overlay').style.display = 'flex';
}
    
    function loadDeviceTypes() {
      fetch('/device-types', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      })
      .then(res => res.json())
      .then(types => {
        deviceTypes = types;
        const select = document.getElementById('device-type');
        select.innerHTML = '<option value="">Selecione um tipo</option>';
        types.forEach(type => {
          const option = document.createElement('option');
          option.value = type._id;
          option.textContent = type.name;
          select.appendChild(option);
        });
      })
      .catch(err => console.error('Erro ao carregar tipos:', err));
    }

 function ignoreDevice() {
  if (currentDevice.mac && currentDevice.mac !== 'Desconhecido') {
    knownMacs.add(currentDevice.mac);
  }
  
  showNotification('Dispositivo ignorado', 'info');
  closeModal();
  showNextDevice();
}

let currentDevices = [];

function renderDeviceList(devices) {
  const container = document.getElementById('devices-container');
  container.innerHTML = '';
  
  if (devices.length === 0) {
    container.innerHTML = '<p>Nenhum dispositivo encontrado</p>';
    return;
  }

  devices.forEach(device => {
    const deviceElement = document.createElement('div');
    deviceElement.className = 'device-item';
    deviceElement.innerHTML = `
      <div>
        <strong>${device.name}</strong>
        <div>IP: ${device.ip}</div>
        <div>MAC: ${device.mac}</div>
      </div>
      <button class="add-btn" data-ip="${device.ip}" data-mac="${device.mac}">
        Adicionar
      </button>
    `;
    
    container.appendChild(deviceElement);
  });

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => addDevice(
      btn.dataset.ip,
      btn.dataset.mac
    ));
  });
}

async function addDevice(ip, mac) {
  const name = prompt('Nome do dispositivo:') || `Dispositivo ${ip}`;
  
  try {
    const response = await fetch('/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ ip, mac, name })
    });
    
    if (!response.ok) throw new Error('Falha ao adicionar');
    
    alert('Dispositivo adicionado com sucesso!');
    runScan();
    
  } catch (error) {
    alert('Erro: ' + error.message);
  }
}


function runScan() {
  fetch('/scan', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(res => {
    if (!res.ok) {
      throw new Error('Erro na resposta do servidor');
    }
    return res.json();
  })
  .then(responseData => {
    let devices;
    if (Array.isArray(responseData)) {
      devices = responseData;
    } else if (responseData.devices && Array.isArray(responseData.devices)) {
      devices = responseData.devices;
    } else {
      throw new Error('Formato de resposta inválido da API');
    }

    const normalizedDevices = devices.map(device => {
      if (device.mac && device.mac.includes('-')) {
        device.mac = device.mac.replace(/-/g, ':');
      }
      return device;
    });

    deviceQueue = normalizedDevices.filter(d => 
  d.ip && 
  d.mac && 
  d.mac !== 'Desconhecido' && 
  !knownMacs.has(d.mac)
);

const devicesWithoutMac = normalizedDevices.filter(d => 
  d.ip && 
  (!d.mac || d.mac === 'Desconhecido') &&
  !Array.from(deviceMap.values()).some(dev => dev.ip === d.ip)
);
    
    deviceQueue = [...deviceQueue, ...devicesWithoutMac];

    if (deviceQueue.length === 0) {
      alert('Nenhum dispositivo novo encontrado.');
      normalizedDevices.forEach(device => {
        if (!deviceMap.has(device.mac)) {
          deviceMap.set(device.mac, device);
          addedDevices.push(device);
        }
      });
      displayResults();
    } else {
      showNextDevice();
    }
  })
  .catch(err => {
    console.error('Erro na análise:', err);
    alert('Erro ao analisar rede: ' + err.message);
  });
}

document.getElementById('scan-btn').addEventListener('click', runScan);
document.getElementById('ignoreAdd')?.addEventListener('click', ignoreDevice);
document.getElementById('confirmAdd')?.addEventListener('click', addDeviceFromModal);
document.querySelector('.modal-close')?.addEventListener('click', () => {
  document.getElementById('modal-overlay').style.display = 'none';
});

    function openAddDeviceModal(device) {
      if (!device || !device.ip || !device.mac) {
        alert("Dispositivo inválido, faltando dados");
        return;
      }
      currentDevice = device;

      document.getElementById('device-ip').textContent = device.ip;
      document.getElementById('device-mac').textContent = device.mac;
      document.getElementById('device-name').value = device.name || '';
      document.getElementById('device-type').value = device.type ? device.type._id : '';
      document.getElementById('device-ssid').value = device.ssid || '';

      document.getElementById('add-device-modal').style.display = 'flex';
      document.getElementById('modal-overlay').style.display = 'block';
    }

    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      window.location.href = 'login.html';
    }

    window.addEventListener('click', (e) => {
    const userIcon = document.getElementById('user-icon');
    const dropdown = document.getElementById('user-dropdown');

    if (userIcon && dropdown && !userIcon.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
    });


    const networkTabBtn = document.getElementById('networkTabBtn');
    if (networkTabBtn) {
    networkTabBtn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tabs button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        networkTabBtn.classList.add('active');
        document.getElementById('networkTab')?.classList.add('active');
    });
    }

    const securityTabBtn = document.getElementById('securityTabBtn');
    if (securityTabBtn) {
      securityTabBtn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tabs button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      document.getElementById('securityTabBtn').classList.add('active');
      document.getElementById('securityTab').classList.add('active');
    });
    }

document.querySelectorAll('.beacon').forEach(beacon => {
  beacon.addEventListener('click', function() {
    document.querySelectorAll('.beacon, .tab-content').forEach(el => {
      el.classList.remove('active');
    });
    
    this.classList.add('active');
    const tabId = this.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'whitelistTab') {
      loadWhitelistData();
    } else if (tabId === 'securityTab') {
      setupSecuritySection();
    }
  });
});

function setupSecuritySection() {
  loadDevicesForSecurityScan();

  const runSecurityScanBtn = document.getElementById('runSecurityScan');
  if (runSecurityScanBtn) {
    runSecurityScanBtn.addEventListener('click', runSecurityScan);
  }
}

function loadDevicesForSecurityScan() {
  const deviceSelect = document.getElementById('securityDeviceSelect');
  if (!deviceSelect) return;

  deviceSelect.innerHTML = '<option value="">Selecione um dispositivo</option>';
  
  addedDevices.forEach(device => {
    if (device.ip && device.ip !== 'Desconhecido') {
      const option = document.createElement('option');
      option.value = device._id;
      option.textContent = `${device.name} (${device.ip})`;
      deviceSelect.appendChild(option);
    }
  });
}

function runSecurityScan() {
  const securityTab = document.getElementById('securityTab');
  if (!securityTab || !securityTab.classList.contains('active')) {
    alert('Por favor, navegue para a aba de Segurança primeiro');
    return;
  }

  const targetInput = document.getElementById('scanTarget');
  const deviceSelect = document.getElementById('securityDeviceSelect');
  
  const target = targetInput ? targetInput.value.trim() : '';
  const selectedDeviceId = deviceSelect ? deviceSelect.value : null;
  
  if (!selectedDeviceId && (!target || !target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))) {
    alert('Por favor, selecione um dispositivo ou insira um endereço IP válido');
    return;
  }
  
  const resultsDiv = document.getElementById('securityResults');
  if (!resultsDiv) {
    console.error('Elemento securityResults não encontrado');
    return;
  }
  
  resultsDiv.innerHTML = '<div class="scan-loading"><i class="fas fa-spinner fa-spin"></i> Analisando... Isto pode levar alguns minutos.</div>';
  
fetch('/security-scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ deviceId: selectedDeviceId })
})
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.error || 'Erro na análise'); });
    }
    return res.json();
  })
  .then(data => {
    displaySecurityResults(data);
  })
  .catch(err => {
    console.error('Erro no security scan:', err);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'scan-error';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Erro: ${err.message}`;
    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(errorDiv);
  });
}

function showGuest() {
  const guest = document.getElementById('welcomeGuest');
  const user = document.getElementById('welcomeUser');
  const nav = document.getElementById('navBeacons');

  guest.style.display = 'block';
  user.style.display = 'none';
  nav.style.display = 'none';
}

function showUser() {
  const guest = document.getElementById('welcomeGuest');
  const user = document.getElementById('welcomeUser');
  const nav = document.getElementById('navBeacons');

  guest.style.display = 'none';
  user.style.display = 'block';
  nav.style.display = 'flex';

    document.querySelectorAll('.beacon, .tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('networkBeacon')?.classList.add('active');
    document.getElementById('networkTab')?.classList.add('active');

    loadDeviceTypes();
    fetchDevices();
    setupSecuritySection();
    }


    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      window.location.href = 'login.html';
    }

async function loadDevicesForSecurityScan() {
  const deviceSelect = document.getElementById('securityDeviceSelect');
  if (!deviceSelect) return;

  const response = await fetch(`/get-devices/${userId}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const devices = await response.json();

  deviceSelect.innerHTML = '<option value="">Selecione um dispositivo</option>';
  
  devices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.ip;
    option.textContent = `${device.name} (${device.ip})`;
    deviceSelect.appendChild(option);
  });
}

async function runSecurityScan() {
  const securityTab = document.getElementById('securityTab');
  if (!securityTab || !securityTab.classList.contains('active')) {
    showNotification('Por favor, navegue para a aba de Segurança primeiro', 'error');
    return;
  }

  const targetInput = document.getElementById('scanTarget');
  const deviceSelect = document.getElementById('securityDeviceSelect');
  
  const target = targetInput ? targetInput.value.trim() : '';
  const selectedDeviceId = deviceSelect ? deviceSelect.value : null;
  
  if (!selectedDeviceId && (!target || !target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))) {
    showNotification('Por favor, selecione um dispositivo ou insira um endereço IP válido', 'error');
    return;
  }
  
  const resultsDiv = document.getElementById('securityResults');
  if (!resultsDiv) {
    console.error('Elemento securityResults não encontrado');
    return;
  }
  
  resultsDiv.innerHTML = '<div class="scan-loading"><i class="fas fa-spinner fa-spin"></i> Analisando... Isto pode levar alguns minutos.</div>';
  
  try {
    const response = await fetch('/security-scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ deviceId: selectedDeviceId })
});
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro na análise');
    }

    const data = await response.json();
    displaySecurityResults(data);
  } catch (err) {
    console.error('Erro no security scan:', err);
    resultsDiv.innerHTML = `
      <div class="scan-error">
        <i class="fas fa-exclamation-triangle"></i> 
        <h4>Erro na Análise de Segurança</h4>
        <p>${err.message || 'Ocorreu um erro durante a análise'}</p>
        <p>Por favor, tente novamente mais tarde ou verifique os logs do sistema.</p>
      </div>
    `;
  }
}

function fetchDevices() {
  const tbody = document.getElementById('devicesTableBody');
  
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">
          Carregando dispositivos...
        </td>
      </tr>
    `;
    
    fetch(`/get-devices/${userId}`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    .then(res => {
      if (!res.ok) throw new Error('Erro ao obter dispositivos');
      return res.json();
    })
    .then(devices => {
      addedDevices.length = 0;
      knownMacs.clear();
      deviceMap.clear();

      devices.forEach(device => {
        device.ip = device.ip || 'Desconhecido';
        device.mac = device.mac || 'Desconhecido';
        device.name = device.name || 'Sem nome';
        
        if (device.mac && device.mac !== 'Desconhecido') {
          knownMacs.add(device.mac);
        }
        const key = device.mac && device.mac !== 'Desconhecido' ? device.mac : device.ip;
        deviceMap.set(key, device);
        addedDevices.push(device);
      });
      
      displayResults();
      loadDevicesForSecurityScan();
    })
    .catch(err => {
      console.error('Erro ao carregar dispositivos:', err);
      const scanResults = document.getElementById('scanResults');
      if (scanResults) {
        scanResults.innerHTML = `<p class="error">Erro ao carregar dispositivos: ${err.message}</p>`;
      }
    });
  }
}

function init() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  

  if (!token || !userId) {
    showGuest();
    return;
  }

  fetch('/protected', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => {
    if (res.ok) {
      showUser();
    } else {
      showGuest();
      logout();
    }
  })
  .catch(err => {
    console.error('Erro na verificação:', err);
    showGuest();
  });
}

document.getElementById('logoutBtn')?.addEventListener('click', logout);
window.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('ignoreAdd')?.addEventListener('click', ignoreDevice);
  document.getElementById('confirmAdd')?.addEventListener('click', addDeviceFromModal);
  document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'none';
  });
  
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').style.display = 'none';
    }
  });
});
