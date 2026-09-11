import { NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'TEMPLATE IMPOR SOAL KUIS - LENTERA BELAJAR',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'PETUNJUK FORMAT PENULISAN:',
                  bold: true,
                }),
              ],
            }),
            new Paragraph({
              text: '- Setiap butir soal harus diawali nomor urut diikuti tanda titik (misal: 1. Pertanyaan...)',
            }),
            new Paragraph({
              text: '- Pilihan ganda ditulis dengan huruf kapital diikuti tanda titik (A. , B. , C. , D. , E.)',
            }),
            new Paragraph({
              text: '- Beri tanda bintang (*) tepat di awal jawaban yang BENAR (contoh: C. *Jawaban Benar)',
            }),
            new Paragraph({
              text: '- Untuk soal Essay/Uraian, tambahkan tag [Essay] di belakang nomor soal (contoh: 4. [Essay] Pertanyaan...)',
            }),
            new Paragraph({
              text: '- Bobot poin per butir soal dapat diatur dengan menulis "Poin: X" di bawah soal (opsional, default 10 untuk PG, 20 untuk Essay)',
            }),
            new Paragraph({
              text: '- Soal bergambar: Sisipkan gambar (insert picture) pada butir soal. Letak gambar akan mengikuti posisi di dokumen (bisa di atas atau di bawah pertanyaan).',
            }),
            new Paragraph({
              text: '- Soal Cerita / Wacana Multi-Soal: Gunakan awalan dengan rentang nomor soal, contoh: [Cerita: 5-7] Teks bacaan... [/Cerita] atau [Wacana untuk soal 5-7]. Teks wacana otomatis hanya disematkan pada nomor soal terkait dan otomatis selesai di nomor berikutnya.',
            }),
            new Paragraph({
              text: '- Beri jarak 1 baris kosong antar butir soal.',
            }),
            new Paragraph({
              text: '--------------------------------------------------',
            }),
            new Paragraph({ text: '' }),

            // Soal 1
            new Paragraph({
              text: '1. Apa ibu kota negara Republik Indonesia saat ini?',
            }),
            new Paragraph({ text: 'A. Bandung' }),
            new Paragraph({ text: 'B. Surabaya' }),
            new Paragraph({ text: 'C. *DKI Jakarta' }),
            new Paragraph({ text: 'D. Medan' }),
            new Paragraph({ text: 'Poin: 10' }),
            new Paragraph({ text: '' }),

            // Soal 2
            new Paragraph({
              text: '2. Lambang sila pertama dalam Pancasila adalah...',
            }),
            new Paragraph({ text: 'A. Rantai Emas' }),
            new Paragraph({ text: 'B. *Bintang' }),
            new Paragraph({ text: 'C. Pohon Beringin' }),
            new Paragraph({ text: 'D. Kepala Banteng' }),
            new Paragraph({ text: 'E. Padi dan Kapas' }),
            new Paragraph({ text: 'Poin: 10' }),
            new Paragraph({ text: '' }),

            // Soal 3
            new Paragraph({
              text: '3. Planet terdekat dari matahari dalam tata surya kita adalah...',
            }),
            new Paragraph({ text: 'A. *Merkurius' }),
            new Paragraph({ text: 'B. Venus' }),
            new Paragraph({ text: 'C. Bumi' }),
            new Paragraph({ text: 'D. Mars' }),
            new Paragraph({ text: 'Poin: 10' }),
            new Paragraph({ text: '' }),

            // Soal 4
            new Paragraph({
              text: '4. [Essay] Jelaskan secara singkat tahapan proses siklus air (hidrologi) di bumi!',
            }),
            new Paragraph({ text: 'Poin: 20' }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // Save a copy to public/templates for direct static serving as well
    try {
      const publicDir = path.resolve(process.cwd(), 'public/templates');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, 'template-soal-kuis.docx'), buffer);
    } catch {
      // Ignore file system write errors if in read-only environment
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="template-soal-kuis.docx"',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating template docx:', error);
    return NextResponse.json(
      { error: 'Gagal membuat file template Word' },
      { status: 500 }
    );
  }
}
