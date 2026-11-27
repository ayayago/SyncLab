# SyncLab

> Pahami sinkronisasi proses secara visual.

🔗 **Demo langsung:** https://ayayago.github.io/SyncLab/

## Deskripsi

SyncLab adalah website simulasi interaktif untuk mempelajari sinkronisasi proses pada sistem operasi. Pengguna dapat mengamati secara langsung bagaimana proses dan thread saling berebut sumber daya bersama, serta bagaimana mekanisme sinkronisasi seperti **Mutex, Peterson, Semaphore, dan Monitor** mencegah *race condition* maupun *deadlock*.

### Fitur Utama

- **3 modul simulasi interaktif:**

  | Modul | Topik | Mekanisme yang dibandingkan |
  |-------|-------|-----------------------------|
  | 01 - Shared Counter | Race Condition | Tanpa Mutex, Peterson, Mutex |
  | 02 - Shared Forks | Dining Philosophers | Mutex, Semaphore, Monitor |
  | 03 - Shared Database | Readers-Writers | Reader-Pref, Writer-Pref, FIFO |

- **Parameter yang bisa diatur:** mekanisme, jumlah thread, nilai awal counter, dan operasi per thread.
- **Mode Step dan Auto Play** untuk menjalankan simulasi langkah demi langkah atau otomatis.
- **Log & State** untuk memantau riwayat kejadian dan status tiap thread (Siap, Membaca, Menghitung, Menulis, Menunggu, Lock, Selesai).
- **Halaman Perbandingan** yang merangkum cara kerja, risiko deadlock, dan kelebihan tiap mekanisme.
- **Halaman Panduan** untuk petunjuk penggunaan.

### Teknologi

HTML, CSS, JavaScript <!-- sesuaikan jika kamu memakai library/framework lain -->

## Instalasi

SyncLab adalah website statis, jadi tidak perlu instalasi tambahan.

**Opsi 1 - Langsung dari browser**

Buka https://ayayago.github.io/SyncLab/

**Opsi 2 - Dijalankan secara lokal**

```bash
# 1. Clone repository
git clone https://github.com/ayayago/SyncLab.git

# 2. Masuk ke folder proyek
cd SyncLab

# 3. Buka homepage.html di browser
#    (klik dua kali file-nya, atau gunakan ekstensi Live Server di VS Code)
```

**Kebutuhan:** browser modern (Chrome, Firefox, Edge, atau Safari).

## Cara Penggunaan

1. Pilih topik melalui menu **Simulasi Modul**, atau klik kartu modul di halaman **Beranda**.
2. Atur **Mekanisme** dan jumlah proses pada panel **Parameter** di sebelah kiri.
3. Klik **Step →** untuk mengamati perubahan state satu langkah demi satu langkah, atau klik **▶ Auto Play** untuk menjalankannya secara otomatis. Klik **Reset** untuk mengulang dari awal.
4. Perhatikan perubahan warna lingkaran proses dan riwayat kejadian pada panel **Log & State** di sebelah kanan untuk mendeteksi terjadinya *deadlock* atau *race condition*.
5. Buka halaman **Perbandingan** untuk melihat ringkasan perbedaan tiap mekanisme.


## Anggota Tim

| Nama | NPM |
|------|-----|
| Raffi Firmansyah | 257006111131 |
| Ayudia Fasha | 257006111138 |
| Ramadhan Adicahaya Firdaus | 257006111141 |
| Alfidi Rahadianto | 257006111166 |
| Muhammad Najmi Ash Siddiq | 257006111164 |
| Renata Putri | 257006111181 |
