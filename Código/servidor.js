const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('./middlewares/rateLimit');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

mongoose.connect('mongodb://localhost:27017/CaraDBela')
  .then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error(err));

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
});
const User = mongoose.model('users', userSchema);

const savedDeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  ip: String,
  mac: { type: String, unique: true },
  name: String,
  addedAt: { type: Date, default: Date.now }
});
const SavedDevice = mongoose.model('saveddevice', savedDeviceSchema);

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
    await new User({ username, passwordHash }).save();
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login bem-sucedido', token, username: user.username, userId: user._id });
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

app.get('/users', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, async (err) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    const users = await User.find({}, 'username _id');
    res.json(users);
  });
});

app.get('/reports', async (req, res) => {
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

app.post('/run-network-scan', (req, res) => {
  const scriptPath = path.join(__dirname, 'scanner.py');
  const pythonProcess = spawn('python', [scriptPath]);

  let output = '';
  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Erro no Python: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    try {
      const jsonData = JSON.parse(output);
      res.json(jsonData);
    } catch (e) {
      res.status(500).json({ erro: 'Erro ao interpretar resposta do script.' });
    }
  });
});

app.post('/add-device', async (req, res) => {
  const { ip, mac, name, userId } = req.body;

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
      await SavedDevice.updateOne(
        { _id: existingDevice._id },
        { $set: { ip, name, userId, mac, addedAt: new Date() } }
      );
      return res.status(200).json({ message: 'Dispositivo atualizado com sucesso' });
    } else {
      const device = new SavedDevice({ ip, mac, name, userId });
      await device.save();
      return res.status(201).json({ message: 'Dispositivo guardado com sucesso' });
    }
  } catch (error) {
    console.error('Erro ao guardar dispositivo:', error);
    res.status(500).json({ message: 'Erro no servidor ao guardar o dispositivo' });
  }
});

app.get('/devices-by-user', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET, async (err) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });

    try {
      const devices = await SavedDevice.find().populate('userId', 'username');
      const grouped = {};

      for (const device of devices) {
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

    const devices = await SavedDevice.find({ userId: requestedUserId }).lean();
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



app.listen(PORT, '0.0.0.0', () => console.log(`Servidor a correr em http://localhost:${PORT}`));
