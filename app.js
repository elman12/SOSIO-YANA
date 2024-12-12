const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');  
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const app = express();
const port = process.env.PORT || 5000;

const waktuUTC = "2024-11-19T06:03:03.000Z";
const waktuJakarta = dayjs(waktuUTC).tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");


// Membuat folder jika belum ada
const imgDir = 'uploads/img/';
const filePermohonanDir = 'uploads/file_permohonan/';

if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
}

if (!fs.existsSync(filePermohonanDir)) {
    fs.mkdirSync(filePermohonanDir, { recursive: true });
}

// Konfigurasi storage untuk multer
const storageGambar = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, imgDir); // Tentukan folder untuk menyimpan gambar ruangan
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Beri nama file unik
    }
});

const storageSuratPermohonan = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, filePermohonanDir); // Tentukan folder untuk menyimpan surat permohonan
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Beri nama file unik
    }
});

// Inisialisasi multer untuk gambar dan surat permohonan
const uploadGambar = multer({ storage: storageGambar });
const uploadSuratPermohonan = multer({ storage: storageSuratPermohonan });

app.use(cors());  // Enable CORS untuk akses dari domain lain
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Menyediakan akses ke folder uploads untuk file statis
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MySQL
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'anjing'
});

// Endpoint untuk menerima upload file gambar dan menyimpan data ruangan
app.post('/room', uploadGambar.single('gambar_ruangan'), (req, res) => {
    const { nama_ruangan, deskripsi, lokasi } = req.body;
    const gambar_ruangan = req.file.path; // Ambil path file yang diupload

    // Validasi input
    if (!nama_ruangan || !deskripsi || !lokasi || !gambar_ruangan) {
        return res.status(400).send({ error: true, message: 'Please provide complete room details' });
    }

    console.log("Received Data:", { nama_ruangan, deskripsi, lokasi, gambar_ruangan });

    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Query untuk menggunakan tabel room
        const query = 'INSERT INTO room (nama_ruangan, deskripsi, lokasi, gambar_ruangan) VALUES (?, ?, ?, ?)';
        connection.query(query, [nama_ruangan, deskripsi, lokasi, gambar_ruangan], (err, result) => {
            connection.release();

            if (!err) {
                res.send({ error: false, message: 'Room created successfully', data: { id: result.insertId, nama_ruangan, deskripsi, lokasi, gambar_ruangan } });
            } else {
                console.log("Database Error:", err);
                res.status(500).send({ error: true, message: 'Failed to create room', detail: err.message });
            }
        });
    });
});

// Endpoint untuk mengambil semua data room
app.get('/rooms', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        const query = 'SELECT * FROM room';
        connection.query(query, (err, results) => {
            connection.release();

            if (!err) {
                console.log('Fetched rooms:', results);  // Log the results from the DB
                res.send({ error: false, data: results });
            } else {
                console.log("Database Error:", err);
                res.status(500).send({ error: true, message: 'Failed to retrieve rooms', detail: err.message });
            }
        });
    });
});

// Endpoint untuk menerima upload file surat permohonan dan menyimpan reservasi
app.post('/reservasi_room', uploadSuratPermohonan.single('surat_permohonan'), (req, res) => {
    // Log untuk memastikan data diterima dengan benar
    console.log("Received body:", req.body);
    console.log("Received file:", req.file);

    // Destructuring body request
    const { nama, nim, organisasi, unit_ruangan, tanggal_peminjaman, tanggal_kembali } = req.body;
    const surat_permohonan = req.file ? req.file.path : null; // Ambil path file jika tersedia

    // Validasi input
    if (!nama || !nim || !organisasi || !unit_ruangan || !tanggal_peminjaman || !tanggal_kembali || !surat_permohonan) {
        return res.status(400).send({
            error: true,
            message: 'Please provide complete reservation details',
            missingFields: {
                nama: !!nama,
                nim: !!nim,
                organisasi: !!organisasi,
                unit_ruangan: !!unit_ruangan,
                tanggal_peminjaman: !!tanggal_peminjaman,
                tanggal_kembali: !!tanggal_kembali,
                surat_permohonan: !!surat_permohonan,
            },
        });
    }


    // Buat koneksi ke database
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database Connection Error:", err);
            return res.status(500).send({ error: true, message: 'Database connection failed' });
        }

        // Query untuk menyimpan data reservasi ke tabel reservasi_room
        const query = `
            INSERT INTO reservasi_room (
                nama, nim, organisasi, unit_ruangan, 
                tanggal_peminjaman, tanggal_kembali, surat_permohonan
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        connection.query(
            query,
            [nama, nim, organisasi, unit_ruangan, tanggal_peminjaman, tanggal_kembali, surat_permohonan],
            (err, result) => {
                connection.release(); // Selalu release koneksi setelah query

                if (err) {
                    console.error("Database Query Error:", err);
                    return res.status(500).send({
                        error: true,
                        message: 'Failed to create reservation',
                        detail: err.message,
                    });
                }

                res.send({
                    error: false,
                    message: 'Reservation created successfully',
                    data: {
                        id: result.insertId,
                        nama,
                        nim,
                        organisasi,
                        unit_ruangan,
                        tanggal_peminjaman,
                        tanggal_kembali,
                        surat_permohonan,
                    },
                });
            }
        );
    });
});


//POST Register
app.post('/register', (req, res) => {
    // Log untuk melihat data yang diterima dari form-data
    console.log("Request Body:", req.body);

    const { username, nim, password } = req.body;

    // Validasi input
    if (!username || !nim || !password) {
        console.error("Missing Fields:", { username, nim, password });
        return res.status(400).send({ 
            error: true, 
            message: 'Please provide username, NIM, and password.' 
        });
    }

    // Hash password sebelum disimpan ke database
    const bcrypt = require('bcrypt');
    const saltRounds = 10;

    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            console.error("Error hashing password:", err);
            return res.status(500).send({ 
                error: true, 
                message: 'Failed to process registration.' 
            });
        }

        // Simpan user ke database
        pool.getConnection((err, connection) => {
            if (err) {
                console.error("Database Connection Error:", err);
                return res.status(500).send({ 
                    error: true, 
                    message: 'Database connection failed.' 
                });
            }

            const query = "INSERT INTO register (username, nim, password) VALUES (?, ?, ?)";

            connection.query(query, [username, nim, hashedPassword], (err, result) => {
                connection.release();

                if (err) {
                    console.error("Database Query Error:", err);
                    return res.status(500).send({ 
                        error: true, 
                        message: 'Failed to register user.', 
                        detail: err.message 
                    });
                }

                res.send({
                    error: false,
                    message: 'User registered successfully.',
                    data: { id: result.insertId, username, nim }
                });
            });
        });
    });
});


//POST Login
// Menggunakan pool yang sudah didefinisikan sebelumnya
app.post('/login', (req, res) => {
    const { nim, password } = req.body;

    if (!nim || !password) {
        return res.status(400).json({ error: true, message: "NIM dan password harus diisi." });
    }

    const query = "SELECT * FROM register WHERE nim = ?";

    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(500).json({ error: true, message: "Kesalahan server." });
        }

        connection.query(query, [nim], (err, results) => {
            connection.release(); // Jangan lupa release koneksi setelah query

            if (err) {
                return res.status(500).json({ error: true, message: "Kesalahan server." });
            }

            if (results.length === 0) {
                return res.status(401).json({ error: true, message: "NIM tidak ditemukan." });
            }

            const user = results[0];

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    return res.status(500).json({ error: true, message: "Kesalahan server." });
                }

                if (!isMatch) {
                    return res.status(401).json({ error: true, message: "Password salah." });
                }

                return res.status(200).json({ 
                    error: false, 
                    message: "Login berhasil.",
                    data: { id: user.id, username: user.username, nim: user.nim }
                });
            });
        });
    });
});



// Endpoint untuk mendapatkan data reservasi_room yang diurutkan berdasarkan tanggal_peminjaman (hari ini dan masa depan)
app.get('/reservasi-room', (req, res) => {
    // Mendapatkan awal hari ini (00:00:00) di zona waktu Asia/Jakarta
    const todayStart = dayjs().tz('Asia/Jakarta').startOf('day').format('YYYY-MM-DD HH:mm:ss');

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Database Connection Error:', err);
            return res.status(500).send({
                error: true,
                message: 'Database connection failed',
            });
        }

        const query = `
            SELECT nama, unit_ruangan, organisasi, tanggal_peminjaman 
            FROM reservasi_room 
            WHERE tanggal_peminjaman >= ? -- Memilih data mulai dari awal hari ini
            ORDER BY tanggal_peminjaman ASC
        `;

        connection.query(query, [todayStart], (err, results) => {
            connection.release();

            if (err) {
                console.error('Database Query Error:', err);
                return res.status(500).send({
                    error: true,
                    message: 'Failed to retrieve reservations',
                    detail: err.message,
                });
            }

            // Konversi tanggal_peminjaman ke zona waktu Asia/Jakarta sebelum dikirimkan ke klien
            const adjustedResults = results.map((row) => ({
                ...row,
                tanggal_peminjaman: dayjs(row.tanggal_peminjaman).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss'),
            }));

            res.send({
                error: false,
                message: 'Reservations retrieved successfully',
                data: adjustedResults,
            });
        });
    });
});




app.get('/reservasi-room/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // Format tanggal hari ini (YYYY-MM-DD)

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Database Connection Error:', err);
            return res.status(500).send({
                error: true,
                message: 'Database connection failed',
            });
        }

        // Query untuk mendapatkan data reservasi berdasarkan tanggal tanpa memperhitungkan waktu
        const query = `
            SELECT nama, unit_ruangan, organisasi, tanggal_peminjaman
            FROM reservasi_room
            WHERE DATE(tanggal_peminjaman) = ?
        `;

        connection.query(query, [today], (err, results) => {
            connection.release(); // Release koneksi setelah query

            if (err) {
                console.error('Database Query Error:', err);
                return res.status(500).send({
                    error: true,
                    message: 'Failed to retrieve reservations',
                    detail: err.message,
                });
            }

            res.send({
                error: false,
                message: 'Reservations retrieved successfully for today',
                date: today,
                data: results,
            });
        });
    });
});


// API untuk GET data berdasarkan ID
app.get('/room/:id', (req, res) => {
    const roomId = req.params.id; // Mendapatkan ID dari URL
    
    // Query untuk mengambil data berdasarkan ID
    const query = 'SELECT * FROM room WHERE id = ?';
    
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error fetching data:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      connection.query(query, [roomId], (err, results) => {
        connection.release(); // Make sure to release the connection after the query

        if (err) {
          console.error('Error fetching data:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
    
        if (results.length > 0) {
          res.json(results[0]); // Mengirimkan data room berdasarkan ID
        } else {
          res.status(404).json({ message: 'Room not found' });
        }
      });
    });
});


// Endpoint: Mendapatkan histori berdasarkan NIM
app.get('/api/history/:nim', (req, res) => {
    const { nim } = req.params;

    const query = `SELECT * FROM reservasi_room WHERE nim = ? ORDER BY tanggal_peminjaman DESC`;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database Connection Error:", err);
            return res.status(500).json({ error: true, message: "Database connection failed." });
        }

        connection.query(query, [nim], (err, results) => {
            connection.release(); // Pastikan koneksi dilepaskan

            if (err) {
                console.error("Database Query Error:", err);
                return res.status(500).json({
                    error: true,
                    message: "Failed to fetch history.",
                    detail: err.message, // Tampilkan pesan error
                });
            }

            res.status(200).json({
                success: true,
                history: results,
            });
        });
    });
});






// Listen on environment port or 5000
app.listen(port, () => console.log(`Listening on port ${port}`));
