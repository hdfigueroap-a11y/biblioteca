const router = require('express').Router();
const pool   = require('../db');

// GET /api/usuarios
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.*,
        COUNT(CASE WHEN p.Estado = 'activo' THEN 1 END) AS prestamos_activos
      FROM  Usuario u
      LEFT JOIN Prestamo p ON u.Id_Usuario = p.Id_Usuario
      GROUP BY u.Id_Usuario
      ORDER BY u.Apellido
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/usuarios/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM Usuario WHERE Id_Usuario = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  const { Nombre, Apellido, Fecha_Registro } = req.body;
  if (!Nombre || !Apellido) return res.status(400).json({ error: 'Nombre y Apellido son requeridos' });
  try {
    const fecha = Fecha_Registro || new Date().toISOString().split('T')[0];
    const [result] = await pool.query(
      'INSERT INTO Usuario (Nombre, Apellido, Fecha_Registro) VALUES (?,?,?)',
      [Nombre, Apellido, fecha]
    );
    res.status(201).json({ id: result.insertId, mensaje: 'Usuario creado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  const { Nombre, Apellido, Fecha_Registro } = req.body;
  try {
    await pool.query(
      'UPDATE Usuario SET Nombre=?, Apellido=?, Fecha_Registro=? WHERE Id_Usuario=?',
      [Nombre, Apellido, Fecha_Registro, req.params.id]
    );
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM Usuario WHERE Id_Usuario = ?', [req.params.id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
