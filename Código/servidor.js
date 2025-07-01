const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('./middlewares/rateLimit');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = 3000;
const NodeCache = require('node-cache');
const scanCache = new NodeCache({ stdTTL: 3600 });

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/CaraDBela')
  .then(async () => {
    console.log('Conectado ao MongoDB');

    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('Um_Dois_Tres_Macaquinho_De_Chines_123!', 10);
      const adminUser = new User({
        username: 'admin',
        passwordHash,
        isAdmin: true
      });
      await adminUser.save();
      console.log('Admin criado com sucesso');
    }

const defaultTypes = [
      { name: 'PC', icon: '💻' },
      { name: 'Telemóvel', icon: '📱' },
      { name: 'Tablet', icon: '📱' },
      { name: 'Tomada Inteligente', icon: '🔌' },
      { name: 'Aspirador', icon: '🧹' },
      { name: 'Router', icon: '📶' },
      { name: 'TV', icon: '📺' }
    ];

    for (const type of defaultTypes) {
      await DeviceType.findOneAndUpdate(
        { name: type.name },
        type,
        { upsert: true, new: true }
      );
    }
  })
  .catch(err => console.error(err));

  const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CaraDBela API',
      version: '1.0.0',
    },
  },
  apis: ['./server.js'],
};

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('users', userSchema);

const deviceTypeSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  icon: String,
  createdAt: { type: Date, default: Date.now }
});
const DeviceType = mongoose.model('DeviceType', deviceTypeSchema);

const savedDeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  ip: String,
  mac: { type: String, unique: true },
  name: String,
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceType' },
  ssid: String,
  addedAt: { type: Date, default: Date.now }
});
const SavedDevice = mongoose.model('saveddevice', savedDeviceSchema);

const SecurityScanLog = mongoose.model('SecurityScanLog', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  ipScanned: String,
  scanType: String,
  results: Object,
  timestamp: { type: Date, default: Date.now }
}));

const whitelistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  allowedMAC: [{
    mac: { type: String, required: true },
    deviceName: String,
    deviceType: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceType' },
    addedAt: { type: Date, default: Date.now },
    isInDividedNetwork: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});
const Whitelist = mongoose.model('Whitelist', whitelistSchema);

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    req.userId = user.id;
    next();
  });
}

function isAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || !user.isAdmin) return res.status(403).json({ message: 'Acesso negado: apenas administradores' });
    req.userId = user.id;
    next();
  });
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_\-+={}[\]|\\:;"'<>,.?/~`]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: 'A password deve ter pelo menos 8 caracteres, uma letra maiúscula e um carácter especial.'
    });
  }

  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'Utilizador já existe' });

    const passwordHash = await bcrypt.hash(password, 10);
    await new User({ username, passwordHash, isAdmin: false }).save();
    res.status(201).json({ message: 'Conta criada com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

const loginAttempts = new Map();

const Report = mongoose.model('Report', new mongoose.Schema({
  ip: String,
  username: String,
  reason: String,
  date: { type: Date, default: Date.now }
}));

app.post('/login', rateLimit, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: null, blockUntil: null };

  if (attempt.blockUntil && Date.now() < attempt.blockUntil) {
    return res.status(429).json({ message: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  try {
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      attempt.count += 1;
      attempt.lastAttempt = Date.now();

        if (attempt.count === 5 || attempt.count === 10) {
          const blockTime = attempt.count === 10 ? 5 * 60 * 1000 : 1 * 60 * 1000;

        await Report.create({
          ip,
          username,
          reason: `Excesso de tentativas (${attempt.count}). Bloqueado por ${blockTime / 60000} min.`
        });
    }


      loginAttempts.set(ip, attempt);
      return res.status(401).json({ message: 'Utilizador ou password inválidos' });
    }

    loginAttempts.delete(ip);

    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login bem-sucedido', token, username: user.username, userId: user._id, isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Erro no servidor' });
  }
});


app.get('/protected', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    res.json({ message: 'Acesso concedido, Bem vindo Samu' });
  });
});

app.get('/users', isAdmin, authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, async (err) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    const users = await User.find({}, 'username _id isAdmin');
    res.json(users);
  });
});

app.get('/reports', isAdmin, authenticateToken, async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, async (err) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    const reports = await Report.find({});
    const grouped = {};

    for (const report of reports) {
      if (!grouped[report.username]) {
        grouped[report.username] = [];
      }
      grouped[report.username].push(report);
    }

    res.json(grouped);
  });
});

app.get('/scan', authenticateToken, async (req, res) => {
  try {
    const scriptPath = path.resolve(__dirname, 'scanner.py');

    const pythonProcess = spawn('python', [scriptPath]);
    
    let data = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    pythonProcess.stderr.on('data', (err) => {
      errorOutput += err.toString();
      console.error('Erro do Python:', err.toString());
    });

    pythonProcess.on('close', (code) => { 
      console.log(`Script Python finalizado com código ${code}`);
      console.log(`Saída: ${data}`);
      console.log(`Erros: ${errorOutput}`);

      if (code !== 0 || errorOutput) {
        return res.status(500).json({ 
          error: 'Erro na execução do scanner',
          detail: errorOutput || 'Código de saída não-zero'
        });
      }

      try {
        const result = JSON.parse(data);
        console.log("Resultado parseado:", result);
        res.json(result);
      } catch (e) {
        console.error('Erro ao parsear JSON:', e);
        res.status(500).json({ 
          error: 'Erro ao interpretar resultado', 
          detail: data 
        });
      }
    });
  } catch (error) {
    console.error('Erro ao executar o script Python:', error);
    res.status(500).json({ 
      error: 'Erro ao executar o scanner', 
      detail: error.message 
    });
  }
});

app.post('/add-device', authenticateToken, async (req, res) => {
  const { ip, mac, name, userId, type, ssid } = req.body;

  if (!ip || !name || !userId) {
    return res.status(400).json({ message: 'Dados incompletos' });
  }

  try {
    let existingDevice = null;

    if (mac && !mac.toLowerCase().includes('desconhecido')) {
      existingDevice = await SavedDevice.findOne({ mac });
    } else {
      existingDevice = await SavedDevice.findOne({ ip, userId });
    }

    if (existingDevice) {
      const updatedDevice = await SavedDevice.findOneAndUpdate(
        { _id: existingDevice._id },
        { $set: { ip, name, userId, mac, type, ssid, addedAt: new Date() } },
        { new: true }
      );
      return res.status(200).json({ 
        message: 'Dispositivo atualizado com sucesso',
        device: updatedDevice 
      });
    } else {
      const device = new SavedDevice({ ip, mac, name, userId, type, ssid });
      await device.save();
      return res.status(201).json({ 
        message: 'Dispositivo guardado com sucesso', 
        device 
      });
    }
  } catch (error) {
    console.error('Erro ao guardar dispositivo:', error);
    return res.status(500).json({ 
      message: 'Erro no servidor ao guardar o dispositivo',
      error: error.message 
    });
  }
});

app.get('/network-scan', authenticateToken, async (req, res) => {
  try {
    const command = process.platform === 'win32' 
      ? 'arp -a | findstr /v "Interface"'
      : 'arp -a | grep -v "incomplete"';

    const arpTable = execSync(command, { encoding: 'utf-8' });
    const devices = [];

    arpTable.split('\n').forEach(line => {
      if (!line.trim()) return;
      
      const matches = line.match(/(\d+\.\d+\.\d+\.\d+).*?(([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2}))/);
      if (matches) {
        devices.push({
          ip: matches[1],
          mac: matches[2].replace(/-/g, ':').toUpperCase(),
          name: `Dispositivo ${devices.length + 1}`
        });
      }
    });

    res.json(devices);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Falha ao escanear rede' });
  }
});

app.post('/devices', authenticateToken, async (req, res) => {
  try {
    const { ip, mac, name, type } = req.body;
    const userId = req.userId;

    const device = new SavedDevice({
      ip,
      mac: mac || 'Desconhecido',
      name,
      type,
      userId
    });

    await device.save();
    res.status(201).json(device);
  } catch (error) {
    res.status(400).json({ error: 'Falha ao adicionar dispositivo' });
  }
});

app.get('/device-types', authenticateToken, async (req, res) => {
  try {
    const types = await DeviceType.find();
    res.json(types);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter tipos de dispositivos' });
  }
});

app.put('/update-device-type/:id', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID de dispositivo inválido' });
    }

    if (type && !mongoose.Types.ObjectId.isValid(type)) {
      return res.status(400).json({ message: 'Tipo de dispositivo inválido' });
    }

    if (type) {
      const typeExists = await DeviceType.findById(type);
      if (!typeExists) {
        return res.status(400).json({ message: 'Tipo de dispositivo não encontrado' });
      }
    }

    const updatedDevice = await SavedDevice.findByIdAndUpdate(
      req.params.id,
      { type: type || null },
      { new: true }
    ).populate('type', 'name');

    if (!updatedDevice) {
      return res.status(404).json({ message: 'Dispositivo não encontrado' });
    }

    res.json(updatedDevice);
  } catch (error) {
    console.error('Erro ao atualizar tipo do dispositivo:', error);
    res.status(500).json({ message: 'Erro ao atualizar tipo do dispositivo' });
  }
});

app.post('/device-types', isAdmin, authenticateToken, async (req, res) => {
  try {
    const { name, icon } = req.body;
    const newType = new DeviceType({ name, icon });
    await newType.save();
    res.status(201).json(newType);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao adicionar tipo de dispositivo' });
  }
});

app.delete('/device-types/:id', isAdmin, authenticateToken, async (req, res) => {
  try {
    await DeviceType.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao eliminar tipo de dispositivo.' });
  }
});

app.get('/devices-by-user', isAdmin, authenticateToken, async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, async (err) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    try {
      const devices = await SavedDevice.find().populate('userId', 'username');
      const grouped = {};

      for (const device of devices) {
        if (!device.userId) {
          continue;
        }

        const userId = device.userId._id.toString();
        const username = device.userId.username;

        if (!grouped[userId]) {
          grouped[userId] = { username, devices: [] };
        }

        grouped[userId].devices.push({
          ip: device.ip,
          mac: device.mac,
          name: device.name,
          addedAt: device.addedAt
        });
      }

      res.json(grouped);
    } catch (error) {
      console.error('Erro ao buscar dispositivos por utilizador:', error);
      res.status(500).json({ message: 'Erro ao carregar dispositivos' });
    }
  });
});

app.get('/get-devices/:userId', authenticateToken, async (req, res) => {
  try {
    const requestedUserId = req.params.userId;

    if (req.userId !== requestedUserId) {
      return res.status(403).json({ message: 'Não está autorizado a aceder a estes dispositivos' });
    }

    const devices = await SavedDevice.find({ userId: requestedUserId })
      .populate('type', 'name')
      .lean();
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});


app.delete('/delete-device/:id', async (req, res) => {
  try {
    await SavedDevice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao eliminar dispositivo.' });
  }
});

const { parseString } = require('xml2js');

function runNmap(ip) {
  return new Promise((resolve, reject) => {
    const scan = spawn('nmap', [
      '-sV',              // Detectar versões
      '-Pn',              // Ignorar ping
      '-O',               // Detetar SO
      '-p-',              // Todas as portas
      '--script', 'vulners', // Vulnerabilidades
      '-oX', '-',         // XML para stdout
      ip
    ]);

    let output = '';
    let errorOutput = '';

    scan.stdout.on('data', (data) => output += data.toString());
    scan.stderr.on('data', (err) => errorOutput += err.toString());

    scan.on('close', (code) => {
      if (code !== 0 || errorOutput) {
        return reject(new Error('Falha na execução do Nmap: ' + errorOutput));
      }

      parseString(output, (err, result) => {
        if (err) return reject(new Error('Erro ao parsear XML: ' + err.message));
        resolve(result);
      });
    });
  });
}

function parseNmapXml(result) {
  const parsed = {
    host: { ip: 'Desconhecido', mac: 'Desconhecido' },
    os: {},
    ports: [],
    vulnerabilities: []
  };

  try {
    const host = result?.nmaprun?.host?.[0];
    if (!host) return parsed;

    const addresses = host.address || [];
    addresses.forEach(addr => {
      if (addr.$.addrtype === 'ipv4') parsed.host.ip = addr.$.addr;
      if (addr.$.addrtype === 'mac') parsed.host.mac = addr.$.addr;
    });

    if (host.os?.[0]?.osmatch?.[0]) {
      parsed.os = {
        name: host.os[0].osmatch[0].$.name,
        accuracy: host.os[0].osmatch[0].$.accuracy
      };
    }

    if (host.ports?.[0]?.port) {
      parsed.ports = host.ports[0].port.map(p => ({
        number: p.$.portid,
        protocol: p.$.protocol,
        state: p.state?.[0]?.$.state || 'desconhecido',
        service: p.service?.[0]?.$.name || 'desconhecido',
        version: (p.service?.[0]?.$.product || '') + ' ' + (p.service?.[0]?.$.version || '')
      }));

      host.ports[0].port.forEach(p => {
        p.script?.forEach(script => {
          if (script.$.id === 'vulners' && script.table) {
            script.table.forEach(table => {
              const elems = table.elem || [];
              parsed.vulnerabilities.push({
                id: table.$.key,
                type: elems[0]?.$.key || 'Desconhecido',
                is_exploit: elems[1]?.$.key === 'exploit',
                description: elems[2]?._ || 'Sem descrição',
                solution: elems[3]?._ || 'Sem solução'
              });
            });
          }
        });
      });
    }

  } catch (err) {
    console.error('Erro ao processar resultado Nmap:', err);
  }

  return parsed;
}

console.log("Executando o comando Nmap:", 'nmap', ['-p-', '-oX', 'resultado.xml', '192.168.1.1']);

const axios = require('axios');

async function runNmapScan(ip) {
  return new Promise((resolve, reject) => {
    const scanProcess = spawn('nmap', [
      '-sV',
      '--script', 'banner',
      '-T4',
      '-Pn',
      ip,
      '-oX', '-'
    ], {
      shell: true,
      timeout: 100000 // 100 segundos
    });

    let scanData = '';
    scanProcess.stdout.on('data', (data) => {
      scanData += data.toString();
    });

    scanProcess.stderr.on('data', (err) => {
      console.error('Erro no NMAP:', err.toString());
    });

    scanProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error('Falha na análise NMAP'));
      }
      
      try {
        const result = parseNmapXml(scanData);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function parseNmapOutput(output) {
  const lines = output.split('\n');
  const result = {
    services: [],
    os: null,
    hostname: null
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.match(/^\d+\/\w+\s+open\s+.+$/)) {
      const parts = line.split(/\s+/);
      const service = {
        port: parts[0],
        state: parts[1],
        service: parts[2],
        version: parts.slice(3).join(' ') || 'Desconhecido'
      };
      result.services.push(service);
    }
    
    else if (line.startsWith('OS details:')) {
      result.os = line.replace('OS details:', '').trim();
    }
    
    else if (line.startsWith('Nmap scan report for')) {
      result.hostname = line.replace('Nmap scan report for', '').trim();
    }
  }

  return result;
}


async function checkVulnerabilities(versionInfo) {
  try {
    const vulnerabilities = [];
    
    for (const component of versionInfo.components) {
      const response = await axios.get(`https://services.nvd.nist.gov/rest/json/cves/1.0`, {
        params: {
          keyword: component.name,
          version: component.version
        }
      });
      
      if (response.data.result.CVE_Items) {
        response.data.result.CVE_Items.forEach(cve => {
          vulnerabilities.push({
            id: cve.cve.CVE_data_meta.ID,
            severity: cve.impact.baseMetricV3?.cvssV3.baseSeverity || 
                     cve.impact.baseMetricV2?.severity || 'MEDIUM',
            description: cve.cve.description.description_data[0].value,
            component: component.name
          });
        });
      }
    }
    
    return vulnerabilities;
  } catch (err) {
    console.error('Erro ao consultar vulnerabilidades:', err);
    return [];
  }
}

async function checkOpenPorts(ip) {
  try {
    const scanResult = await runNmapScan(ip);
    return scanResult.services
      .filter(s => s.state === 'open')
      .map(s => ({
        port: s.port,
        service: s.service,
        version: s.version
      }));
  } catch (err) {
    console.error('Erro ao verificar portas abertas:', err);
    return [];
  }
}


async function logSecurityScan(userId, ipScanned, scanType, results) {
  await new SecurityScanLog({
    userId,
    ipScanned,
    scanType,
    results
  }).save();
}

app.post('/security-scan', authenticateToken, async (req, res) => {
  const { deviceId } = req.body;

  try {
    let device;

    if (mongoose.Types.ObjectId.isValid(deviceId)) {
      device = await SavedDevice.findById(deviceId);
    } else {
      device = await SavedDevice.findOne({ ip: deviceId });
    }

    if (!device) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    const rawResult = await runNmap(device.ip);
    const parsedResult = parseNmapXml(rawResult);

    await SecurityScanLog.create({
      userId: req.userId,
      ipScanned: device.ip,
      scanType: 'manual',
      results: parsedResult
    });

    res.json(parsedResult);
  } catch (err) {
    console.error('Erro no scanner de segurança:', err);
    res.status(500).json({ error: 'Erro na análise de segurança', detail: err.message });
  }
});


app.post('/detect-device-type', authenticateToken, async (req, res) => {
  try {
    const { mac, deviceId } = req.body;
    
    if (!mac || !deviceId) {
      return res.status(400).json({ message: 'MAC e ID do dispositivo são necessários' });
    }

    res.json({ 
      success: false,
      message: 'Detecção por MAC não está disponível',
      detectionInfo: null
    });
  } catch (error) {
    console.error('Erro ao detectar tipo:', error);
    res.status(500).json({ message: 'Erro ao detectar tipo do dispositivo' });
  }
});

app.post('/whitelist/add', authenticateToken, async (req, res) => {
  try {
    const { mac, deviceName, deviceType } = req.body;
    const userId = req.userId;

    if (!mac) {
      return res.status(400).json({ message: 'Endereço MAC é obrigatório' });
    }

    const whitelist = await Whitelist.findOne({ userId });
    const exists = whitelist?.allowedMAC.some(item => 
      item.mac.toLowerCase() === mac.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({ message: 'Dispositivo já está na whitelist' });
    }

    whitelist.allowedMAC.push({
      mac,
      deviceName: deviceName || device.name,
      deviceType: deviceType || device.type
    });

    await whitelist.save();
    res.json({ success: true, whitelist });
  } catch (error) {
    console.error('Erro ao adicionar à whitelist:', error);
    res.status(500).json({ message: 'Erro ao adicionar à whitelist' });
  }
});

app.post('/whitelist/remove', authenticateToken, async (req, res) => {
  try {
    const { mac } = req.body;
    const userId = req.userId;

    const whitelist = await Whitelist.findOne({ userId });
    if (!whitelist) {
      return res.status(404).json({ message: 'Whitelist não encontrada' });
    }

    whitelist.allowedMAC = whitelist.allowedMAC.filter(item => item.mac.toLowerCase() !== mac.toLowerCase());
    await whitelist.save();
    res.json({ success: true, whitelist });
  } catch (error) {
    console.error('Erro ao remover da whitelist:', error);
    res.status(500).json({ message: 'Erro ao remover da whitelist' });
  }
});

app.post('/whitelist/move-to-divided', authenticateToken, async (req, res) => {
  try {
    const { mac } = req.body;
    const userId = req.userId;

    const whitelist = await Whitelist.findOne({ userId });
    if (!whitelist) {
      return res.status(404).json({ message: 'Whitelist não encontrada' });
    }

    const deviceIndex = whitelist.allowedMAC.findIndex(item => item.mac.toLowerCase() === mac.toLowerCase());
    if (deviceIndex === -1) {
      return res.status(404).json({ message: 'Dispositivo não encontrado na whitelist' });
    }

    whitelist.allowedMAC[deviceIndex].isInDividedNetwork = !whitelist.allowedMAC[deviceIndex].isInDividedNetwork;
    await whitelist.save();

    res.json({ 
      success: true, 
      isInDividedNetwork: whitelist.allowedMAC[deviceIndex].isInDividedNetwork 
    });
  } catch (error) {
    console.error('Erro ao mover para rede dividida:', error);
    res.status(500).json({ message: 'Erro ao mover para rede dividida' });
  }
});

app.get('/whitelist', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const whitelist = await Whitelist.findOne({ userId }).populate('allowedMAC.deviceType');
    
    if (!whitelist) {
      return res.json({ allowedMAC: [] });
    }

    res.json(whitelist);
  } catch (error) {
    console.error('Erro ao obter whitelist:', error);
    res.status(500).json({ message: 'Erro ao obter whitelist' });
  }
});

app.use(express.static('frontend'));

app.listen(PORT, '0.0.0.0', () => console.log(`Servidor a correr em http://localhost:${PORT}`));
