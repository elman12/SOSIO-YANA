const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

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

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MySQL
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fast-app'
});

// Endpoint untuk menerima upload file gambar dan menyimpan data ruangan
app.post('/room', uploadGambar.single('gambar_ruangan'), (req, res) => {
    const { nama_ruangan, deskripsi, lokasi } = req.body;
    const gambar_ruangan = req.file.path; // Ambil path file yang diupload

    // Validasi input
    if (!nama_ruangan || !deskripsi || !lokasi || !gambar_ruangan) {
        return res.status(400).send({ error: true, message: 'Please provide complete room details' });
    }

    console.log("Received Data:", { nama_ruangan, deskripsi, lokasi, gambar_ruangan }); // Tambahkan log untuk data yang diterima

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

// Endpoint untuk menerima upload file surat permohonan dan menyimpan reservasi
app.post('/reservasi_room', uploadSuratPermohonan.single('surat_permohonan'), (req, res) => {
    const { nama, nim, organisasi, unit_ruangan, tanggal_peminjaman, tanggal_kembali } = req.body;
    const surat_permohonan = req.file.path; // Ambil path file yang diupload

    // Validasi input
    if (!nama || !nim || !organisasi || !unit_ruangan || !tanggal_peminjaman || !tanggal_kembali || !surat_permohonan) {
        return res.status(400).send({ error: true, message: 'Please provide complete reservation details' });
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Query untuk menggunakan tabel reservasi_room
        const query = 'INSERT INTO reservasi_room (nama, nim, organisasi, unit_ruangan, tanggal_peminjaman, tanggal_kembali, surat_permohonan) VALUES (?, ?, ?, ?, ?, ?, ?)';
        connection.query(query, [nama, nim, organisasi, unit_ruangan, tanggal_peminjaman, tanggal_kembali, surat_permohonan], (err, result) => {
            connection.release();

            if (!err) {
                res.send({ error: false, message: 'Reservation created successfully', data: { id: result.insertId, nama, nim, organisasi, unit_ruangan, tanggal_peminjaman, tanggal_kembali, surat_permohonan } });
            } else {
                console.log("Database Error:", err);
                res.status(500).send({ error: true, message: 'Failed to create reservation', detail: err.message });
            }
        });
    });
});


// Endpoint untuk mengambil semua data room
app.get('/rooms', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Query untuk mengambil semua data dari tabel room
        const query = 'SELECT * FROM room';
        connection.query(query, (err, results) => {
            connection.release();

            if (!err) {
                res.send({ error: false, data: results });
            } else {
                console.log("Database Error:", err);
                res.status(500).send({ error: true, message: 'Failed to retrieve rooms', detail: err.message });
            }
        });
    });
});

// Endpoint untuk mengambil semua data reservasi_room
app.get('/reservasi_rooms', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Query untuk mengambil semua data dari tabel reservasi_room
        const query = 'SELECT * FROM reservasi_room';
        connection.query(query, (err, results) => {
            connection.release();

            if (!err) {
                res.send({ error: false, data: results });
            } else {
                console.log("Database Error:", err);
                res.status(500).send({ error: true, message: 'Failed to retrieve reservations', detail: err.message });
            }
        });
    });
});


// Listen on environment port or 5000
app.listen(port, () => console.log(`Listening on port ${port}`));
