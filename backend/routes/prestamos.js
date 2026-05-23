const router = require('express').Router();
const pool   = require('../db');

// GET /api/prestamos?estado=activo
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT
        p.Id_Prestamo, p.Fecha_Prestamo, p.Fecha_Dev_Esp,
        p.Fecha_Dev_Real, p.Estado,
        CONCAT(u.Nombre, ' ', u.Apellido) AS usuario,
        l.Titulo                           AS libro,
        l.Id_Libro
      FROM  Prestamo p
      JOIN  Ejemplar ej ON p.Id_Ejemplar = ej.Id_Ejemplar
      JOIN  Libros   l  ON ej.Id_Libro   = l.Id_Libro
      JOIN  Usuario  u  ON p.Id_Usuario  = u.Id_Usuario
    `;
    const params = [];
    if (req.query.estado) {
      query += ' WHERE p.Estado = ?';
      params.push(req.query.estado);
    }
    query += ' ORDER BY p.Fecha_Prestamo DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prestamos — llama al procedimiento almacenado
router.post('/', async (req, res) => {
  const { Id_Ejemplar, Id_Usuario, Dias_Prestamo } = req.body;
  if (!Id_Ejemplar || !Id_Usuario) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    await pool.query('CALL sp_registrar_prestamo(?, ?, ?, @resultado)', [
      Id_Ejemplar, Id_Usuario, Dias_Prestamo || 14
    ]);
    const [[{ resultado }]] = await pool.query('SELECT @resultado AS resultado');
    if (resultado.startsWith('ERROR')) return res.status(400).json({ error: resultado });
    res.status(201).json({ mensaje: resultado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/prestamos/:id/devolver — llama al procedimiento de devolución
router.put('/:id/devolver', async (req, res) => {
  const { multa_por_dia = 1000 } = req.body;
  try {
    await pool.query('CALL sp_registrar_devolucion(?, ?, @resultado)', [
      req.params.id, multa_por_dia
    ]);
    const [[{ resultado }]] = await pool.query('SELECT @resultado AS resultado');
    if (resultado.startsWith('ERROR')) return res.status(400).json({ error: resultado });
    res.json({ mensaje: resultado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
