const pool = require('../db');

async function initDB() {
  const conn = await pool.getConnection();
  try {
    console.log('Iniciando configuración de la base de datos...');

    // ── TABLAS ──────────────────────────────────────────────────────────────

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Editorial (
        Id_Editorial  INT          AUTO_INCREMENT PRIMARY KEY,
        Nombre        VARCHAR(100) NOT NULL,
        Pais          VARCHAR(60)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Categoria (
        Id_Categoria      INT         AUTO_INCREMENT PRIMARY KEY,
        Nombre_Categoria  VARCHAR(80) NOT NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Autor (
        Id_Autor  INT         AUTO_INCREMENT PRIMARY KEY,
        Nombre    VARCHAR(80) NOT NULL,
        Apellido  VARCHAR(80) NOT NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Libros (
        Id_Libro          INT          AUTO_INCREMENT PRIMARY KEY,
        ISBN              VARCHAR(20)  NOT NULL UNIQUE,
        Titulo            VARCHAR(200) NOT NULL,
        Anio_Publicacion  YEAR,
        Id_Categoria      INT,
        Id_Editorial      INT,
        FOREIGN KEY (Id_Categoria) REFERENCES Categoria(Id_Categoria),
        FOREIGN KEY (Id_Editorial) REFERENCES Editorial(Id_Editorial)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Libro_Autor (
        Id_Libro  INT NOT NULL,
        Id_Autor  INT NOT NULL,
        PRIMARY KEY (Id_Libro, Id_Autor),
        FOREIGN KEY (Id_Libro) REFERENCES Libros(Id_Libro),
        FOREIGN KEY (Id_Autor) REFERENCES Autor(Id_Autor)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Ejemplar (
        Id_Ejemplar  INT  AUTO_INCREMENT PRIMARY KEY,
        Id_Libro     INT  NOT NULL,
        Estado       ENUM('disponible','prestado','mantenimiento') DEFAULT 'disponible',
        FOREIGN KEY (Id_Libro) REFERENCES Libros(Id_Libro)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Usuario (
        Id_Usuario      INT         AUTO_INCREMENT PRIMARY KEY,
        Nombre          VARCHAR(80) NOT NULL,
        Apellido        VARCHAR(80) NOT NULL,
        Fecha_Registro  DATE        NOT NULL DEFAULT (CURRENT_DATE)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Prestamo (
        Id_Prestamo    INT  AUTO_INCREMENT PRIMARY KEY,
        Id_Ejemplar    INT  NOT NULL,
        Id_Usuario     INT  NOT NULL,
        Fecha_Prestamo DATE NOT NULL DEFAULT (CURRENT_DATE),
        Fecha_Dev_Esp  DATE NOT NULL,
        Fecha_Dev_Real DATE,
        Estado         ENUM('activo','devuelto','vencido') DEFAULT 'activo',
        FOREIGN KEY (Id_Ejemplar) REFERENCES Ejemplar(Id_Ejemplar),
        FOREIGN KEY (Id_Usuario)  REFERENCES Usuario(Id_Usuario)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS Multa (
        Id_Multa    INT           AUTO_INCREMENT PRIMARY KEY,
        Id_Prestamo INT           NOT NULL UNIQUE,
        Estado      ENUM('pendiente','pagada') DEFAULT 'pendiente',
        Monto       DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (Id_Prestamo) REFERENCES Prestamo(Id_Prestamo)
      )
    `);

    console.log('Tablas creadas correctamente.');

    // ── TRIGGERS ────────────────────────────────────────────────────────────

    await conn.query(`DROP TRIGGER IF EXISTS trg_after_insert_prestamo`);
    await conn.query(`
      CREATE TRIGGER trg_after_insert_prestamo
      AFTER INSERT ON Prestamo
      FOR EACH ROW
      BEGIN
        UPDATE Ejemplar SET Estado = 'prestado'
        WHERE Id_Ejemplar = NEW.Id_Ejemplar;
      END
    `);

    await conn.query(`DROP TRIGGER IF EXISTS trg_after_update_prestamo`);
    await conn.query(`
      CREATE TRIGGER trg_after_update_prestamo
      AFTER UPDATE ON Prestamo
      FOR EACH ROW
      BEGIN
        IF NEW.Estado = 'devuelto' AND OLD.Estado != 'devuelto' THEN
          UPDATE Ejemplar SET Estado = 'disponible'
          WHERE Id_Ejemplar = NEW.Id_Ejemplar;
        END IF;
      END
    `);

    console.log('Triggers creados correctamente.');

    // ── PROCEDIMIENTOS ───────────────────────────────────────────────────────

    await conn.query(`DROP PROCEDURE IF EXISTS sp_registrar_prestamo`);
    await conn.query(`
      CREATE PROCEDURE sp_registrar_prestamo(
        IN  p_Id_Ejemplar   INT,
        IN  p_Id_Usuario    INT,
        IN  p_Dias_Prestamo INT,
        OUT p_Resultado     VARCHAR(300)
      )
      BEGIN
        DECLARE v_Estado_Ejemplar   VARCHAR(20);
        DECLARE v_Prestamos_Activos INT;

        SELECT Estado INTO v_Estado_Ejemplar
        FROM   Ejemplar WHERE Id_Ejemplar = p_Id_Ejemplar;

        SELECT COUNT(*) INTO v_Prestamos_Activos
        FROM   Prestamo
        WHERE  Id_Usuario = p_Id_Usuario AND Estado = 'activo';

        IF v_Estado_Ejemplar IS NULL THEN
          SET p_Resultado = 'ERROR: Ejemplar no encontrado.';
        ELSEIF v_Estado_Ejemplar != 'disponible' THEN
          SET p_Resultado = CONCAT('ERROR: Ejemplar no disponible. Estado: ', v_Estado_Ejemplar);
        ELSEIF v_Prestamos_Activos >= 3 THEN
          SET p_Resultado = 'ERROR: El usuario ya tiene 3 préstamos activos.';
        ELSE
          START TRANSACTION;
            INSERT INTO Prestamo (Id_Ejemplar, Id_Usuario, Fecha_Prestamo, Fecha_Dev_Esp, Estado)
            VALUES (p_Id_Ejemplar, p_Id_Usuario, CURDATE(),
                    DATE_ADD(CURDATE(), INTERVAL p_Dias_Prestamo DAY), 'activo');
          COMMIT;
          SET p_Resultado = CONCAT(
            'OK: Préstamo registrado. Fecha límite: ',
            DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL p_Dias_Prestamo DAY), '%d/%m/%Y')
          );
        END IF;
      END
    `);

    await conn.query(`DROP PROCEDURE IF EXISTS sp_registrar_devolucion`);
    await conn.query(`
      CREATE PROCEDURE sp_registrar_devolucion(
        IN  p_Id_Prestamo    INT,
        IN  p_Multa_Por_Dia  DECIMAL(10,2),
        OUT p_Resultado      VARCHAR(300)
      )
      BEGIN
        DECLARE v_Estado       VARCHAR(20);
        DECLARE v_Fecha_Esp    DATE;
        DECLARE v_Id_Ejemplar  INT;
        DECLARE v_Dias_Vencido INT           DEFAULT 0;
        DECLARE v_Monto_Multa  DECIMAL(10,2) DEFAULT 0;

        SELECT Estado, Fecha_Dev_Esp, Id_Ejemplar
        INTO   v_Estado, v_Fecha_Esp, v_Id_Ejemplar
        FROM   Prestamo WHERE Id_Prestamo = p_Id_Prestamo;

        IF v_Estado IS NULL THEN
          SET p_Resultado = 'ERROR: Préstamo no encontrado.';
        ELSEIF v_Estado = 'devuelto' THEN
          SET p_Resultado = 'ERROR: Este préstamo ya fue devuelto.';
        ELSE
          SET v_Dias_Vencido = GREATEST(0, DATEDIFF(CURDATE(), v_Fecha_Esp));
          START TRANSACTION;
            UPDATE Prestamo
            SET    Fecha_Dev_Real = CURDATE(), Estado = 'devuelto'
            WHERE  Id_Prestamo = p_Id_Prestamo;

            IF v_Dias_Vencido > 0 THEN
              SET v_Monto_Multa = v_Dias_Vencido * p_Multa_Por_Dia;
              INSERT INTO Multa (Id_Prestamo, Monto, Estado)
              VALUES (p_Id_Prestamo, v_Monto_Multa, 'pendiente')
              ON DUPLICATE KEY UPDATE Monto = v_Monto_Multa;
            END IF;
          COMMIT;

          IF v_Dias_Vencido > 0 THEN
            SET p_Resultado = CONCAT('OK: Devuelto con ', v_Dias_Vencido,
              ' día(s) de retraso. Multa: $', FORMAT(v_Monto_Multa, 0), ' COP.');
          ELSE
            SET p_Resultado = 'OK: Devolución registrada a tiempo. Sin multa.';
          END IF;
        END IF;
      END
    `);

    console.log('Procedimientos creados correctamente.');

    // ── DATOS DE PRUEBA (solo si las tablas están vacías) ────────────────────

    const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM Editorial');
    if (total > 0) {
      console.log('Datos de prueba ya existen, omitiendo seed.');
      return;
    }

    await conn.query(`
      INSERT INTO Editorial (Nombre, Pais) VALUES
        ('McGraw-Hill','Estados Unidos'),('Pearson','Colombia'),
        ('Alfaomega','México'),("O'Reilly",'Estados Unidos'),
        ('Fondo de Cultura','México'),('Norma','Colombia'),('Planeta','Colombia')
    `);

    await conn.query(`
      INSERT INTO Categoria (Nombre_Categoria) VALUES
        ('Ingeniería de Software'),('Bases de Datos'),('Economía'),
        ('Matemáticas'),('Programación'),('Redes y Sistemas'),
        ('Historia del Pensamiento Económico')
    `);

    await conn.query(`
      INSERT INTO Autor (Nombre, Apellido) VALUES
        ('Robert','Martin'),('Abraham','Silberschatz'),('N. Gregory','Mankiw'),
        ('Kenneth','Rosen'),('Brian','Kernighan'),('Dennis','Ritchie'),
        ('Ian','Sommerville'),('Andrew','Tanenbaum'),('Paul','Krugman'),
        ('Robin','Nixon'),('Thomas','Cormen'),('Charles','Leiserson')
    `);

    await conn.query(`
      INSERT INTO Libros (ISBN, Titulo, Anio_Publicacion, Id_Categoria, Id_Editorial) VALUES
        ('978-0-13-468599-1','Clean Code',2008,1,2),
        ('978-0-13-235088-4','Database System Concepts',2010,2,2),
        ('978-958-682-846-3','Fundamentos de Economía',2015,3,2),
        ('978-0-07-338359-2','Discrete Mathematics',2012,4,1),
        ('978-0-13-110362-7','The C Programming Language',1988,5,2),
        ('978-0-13-604133-9','Software Engineering',2016,1,2),
        ('978-0-596-51774-8','Learning MySQL',2007,2,4),
        ('978-0-13-349201-4','Computer Networks',2010,6,2),
        ('978-0-393-97509-8','International Economics',2014,3,5),
        ('978-0-262-03384-8','Introduction to Algorithms',2009,4,1)
    `);

    await conn.query(`
      INSERT INTO Libro_Autor (Id_Libro, Id_Autor) VALUES
        (1,1),(2,2),(3,3),(4,4),(5,5),(5,6),(6,7),(7,10),(8,8),(9,9),(10,11),(10,12)
    `);

    await conn.query(`
      INSERT INTO Ejemplar (Id_Libro, Estado) VALUES
        (1,'disponible'),(1,'prestado'),(2,'disponible'),(2,'disponible'),
        (3,'prestado'),(3,'disponible'),(4,'disponible'),(5,'mantenimiento'),
        (6,'disponible'),(6,'prestado'),(7,'disponible'),(8,'disponible'),
        (9,'disponible'),(10,'disponible'),(10,'prestado')
    `);

    await conn.query(`
      INSERT INTO Usuario (Nombre, Apellido, Fecha_Registro) VALUES
        ('Carlos','Ramírez','2021-02-01'),('María','González','2022-02-15'),
        ('Andrés','Vargas','2019-08-01'),('Valentina','Torres','2023-02-10'),
        ('Luis','Herrera','2020-01-15'),('Sofía','Pérez','2021-03-01'),
        ('Diego','Morales','2022-07-20'),('Camila','Jiménez','2023-01-08')
    `);

    await conn.query(`
      INSERT INTO Prestamo (Id_Ejemplar, Id_Usuario, Fecha_Prestamo, Fecha_Dev_Esp, Fecha_Dev_Real, Estado) VALUES
        (2,1,'2024-04-01','2024-04-15',NULL,'activo'),
        (10,4,'2024-04-05','2024-04-19',NULL,'activo'),
        (15,7,'2024-04-08','2024-04-22',NULL,'activo'),
        (5,3,'2024-03-20','2024-04-03',NULL,'vencido'),
        (3,2,'2024-03-10','2024-03-24','2024-03-22','devuelto'),
        (11,5,'2024-03-05','2024-03-19','2024-03-18','devuelto')
    `);

    await conn.query(`
      INSERT INTO Multa (Id_Prestamo, Monto, Estado) VALUES
        (4, 15000.00, 'pendiente')
    `);

    console.log('Datos de prueba cargados correctamente.');

  } catch (err) {
    console.error('Error en initDB:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = initDB;
