const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Servir frontend

const mongoURI = 'mongodb://localhost:27017/CaraDBela';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado ao MongoDB');
}).catch(err => {
  console.error('Erro ao conectar MongoDB:', err);
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
});

const User = mongoose.model('users', userSchema);

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) {
    return res.status(400).json({ message: 'Username e senha são obrigatórios' });
  }
  try {
    const existingUser = await User.findOne({ username });
    if(existingUser) {
      return res.status(409).json({ message: 'Usuário já existe' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({ username, passwordHash });
    await newUser.save();
    res.status(201).json({ message: 'Conta criada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) {
    return res.status(400).json({ message: 'Username e senha são obrigatórios' });
  }
  try {
    const user = await User.findOne({ username });
    if(!user) {
      return res.status(401).json({ message: 'Usuário ou senha incorretos' });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if(!isMatch) {
      return res.status(401).json({ message: 'Usuário ou senha incorretos' });
    }
    res.json({ message: 'Login bem-sucedido' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
