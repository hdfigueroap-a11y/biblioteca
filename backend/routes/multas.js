const router = require('express').Router();
const pool   = require('../db');

// GET /api/multas?estado=pendiente
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT
        m.Id_Multa, m.Monto, m.Estado,
        m.Id_Prestamo,
        CONCAT(u.Nombre, ' ', u.Apellido) AS usuario,
        l.Titulo                           AS libro
      FROM  Multa    m
      JOIN  Prestamo p  ON m.Id_Prestamo = p.Id_Prestamo
      JOIN  Ejemplar ej ON p.Id_Ejemplar = ej.Id_Ejemplar
      JOIN  Libros   l  ON ej.Id_Libro   = l.Id_Libro
      JOIN  Usuario  u  ON p.Id_Usuario  = u.Id_Usuario
    `;
    const params = [];
    if (req.query.estado) {
      query += ' WHERE m.Estado = ?';
      params.push(req.query.estado);
    }
    query += ' ORDER BY m.Id_Multa DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/multas/:id/pagar
router.put('/:id/pagar', async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE Multa SET Estado = 'pagada' WHERE Id_Multa = ?", [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Multa no encontrada' });
    res.json({ mensaje: 'Multa registrada como pagada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
