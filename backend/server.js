const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(express.json());

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/libros',      require('./routes/libros'));
app.use('/api/usuarios',    require('./routes/usuarios'));
app.use('/api/prestamos',   require('./routes/prestamos'));
app.use('/api/multas',      require('./routes/multas'));
app.use('/api/categorias',  require('./routes/categorias'));
app.use('/api/editoriales', require('./routes/editoriales'));

// ── Health check (Railway lo necesita) ────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', mensaje: 'API Biblioteca Universitaria' });
});

// ── Manejo de errores global ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
