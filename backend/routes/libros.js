const router = require('express').Router();
const pool   = require('../db');

// GET /api/libros — todos los libros con autor, categoría y editorial
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.Id_Libro, l.ISBN, l.Titulo, l.Anio_Publicacion,
        c.Nombre_Categoria  AS categoria,
        e.Nombre            AS editorial,
        GROUP_CONCAT(CONCAT(a.Nombre, ' ', a.Apellido) SEPARATOR ', ') AS autores
      FROM  Libros      l
      JOIN  Categoria   c  ON l.Id_Categoria = c.Id_Categoria
      JOIN  Editorial   e  ON l.Id_Editorial  = e.Id_Editorial
      LEFT JOIN Libro_Autor la ON l.Id_Libro  = la.Id_Libro
      LEFT JOIN Autor        a  ON la.Id_Autor = a.Id_Autor
      GROUP BY l.Id_Libro
      ORDER BY l.Titulo
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/libros/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM Libros WHERE Id_Libro = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Libro no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/libros
router.post('/', async (req, res) => {
  const { ISBN, Titulo, Anio_Publicacion, Id_Categoria, Id_Editorial } = req.body;
  if (!ISBN || !Titulo) return res.status(400).json({ error: 'ISBN y Título son requeridos' });
  try {
    const [result] = await pool.query(
      'INSERT INTO Libros (ISBN, Titulo, Anio_Publicacion, Id_Categoria, Id_Editorial) VALUES (?,?,?,?,?)',
      [ISBN, Titulo, Anio_Publicacion, Id_Categoria, Id_Editorial]
    );
    res.status(201).json({ id: result.insertId, mensaje: 'Libro creado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/libros/:id
router.put('/:id', async (req, res) => {
  const { ISBN, Titulo, Anio_Publicacion, Id_Categoria, Id_Editorial } = req.body;
  try {
    await pool.query(
      'UPDATE Libros SET ISBN=?, Titulo=?, Anio_Publicacion=?, Id_Categoria=?, Id_Editorial=? WHERE Id_Libro=?',
      [ISBN, Titulo, Anio_Publicacion, Id_Categoria, Id_Editorial, req.params.id]
    );
    res.json({ mensaje: 'Libro actualizado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/libros/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM Libros WHERE Id_Libro = ?', [req.params.id]);
    res.json({ mensaje: 'Libro eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
