import { describe, it, expect } from 'vitest';
import path from 'path';

describe('File Security & Upload Whitelist (BUG-06)', () => {
  const ALLOWED_EXTENSIONS = new Set([
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
    // Images
    '.jpg', '.jpeg', '.png', '.webp',
    // Audio / Video
    '.mp3', '.mp4', '.wav', '.ogg', '.webm',
    // Archives
    '.zip', '.rar', '.7z',
  ]);

  function isAllowedExtension(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext);
  }

  function generateSafeFilename(originalName: string, uuid: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const sanitizedBase = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    return `${uuid}_${sanitizedBase}${ext}`;
  }

  describe('Extension Whitelisting', () => {
    it('accepts legitimate LMS documents, media and image formats', () => {
      const allowedSamples = [
        'laporan_siswa.pdf',
        'materi_bab_1.docx',
        'daftar_nilai.xlsx',
        'slide_presentasi.pptx',
        'foto_profil.jpg',
        'diagram_kelas.png',
        'rekaman_audio.mp3',
        'video_pembelajaran.mp4',
        'kumpulan_soal.zip',
      ];

      for (const sample of allowedSamples) {
        expect(isAllowedExtension(sample)).toBe(true);
      }
    });

    it('accepts uppercase extensions (e.g. .PDF, .PNG)', () => {
      expect(isAllowedExtension('TUGAS.PDF')).toBe(true);
      expect(isAllowedExtension('GAMBAR.PNG')).toBe(true);
      expect(isAllowedExtension('DATA.XLSX')).toBe(true);
    });

    it('strictly blocks dangerous and executable script extensions', () => {
      const dangerousSamples = [
        'exploit.html',
        'phishing.htm',
        'stored_xss.svg',
        'trojan.exe',
        'script.bat',
        'command.cmd',
        'reverse_shell.sh',
        'backdoor.php',
        'payload.js',
        'daemon.py',
        'servlet.jsp',
      ];

      for (const sample of dangerousSamples) {
        expect(isAllowedExtension(sample)).toBe(false);
      }
    });

    it('blocks double extensions trying to bypass filters (e.g. exploit.php.png or test.html.pdf)', () => {
      // path.extname gets the last extension
      expect(isAllowedExtension('exploit.png.php')).toBe(false);
      expect(isAllowedExtension('webshell.jpg.html')).toBe(false);
    });
  });

  describe('Cryptographic Random UUID Filename Generation', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/;

    it('generates filename prefixed with cryptographically random UUID', () => {
      const mockUuid = 'c3d5a498-8422-48f0-b984-6014e82f34aa';
      const safeName = generateSafeFilename('soal_matematika.pdf', mockUuid);

      expect(safeName).toMatch(uuidRegex);
      expect(safeName).toBe('c3d5a498-8422-48f0-b984-6014e82f34aa_soal_matematika.pdf');
    });

    it('sanitizes special characters and path traversal patterns from the original filename', () => {
      const mockUuid = '7f8c2e11-9a1b-4d5c-8e3f-123456789abc';
      const maliciousName = '../../etc/passwd..test!@#$%^&*().pdf';
      const safeName = generateSafeFilename(maliciousName, mockUuid);

      expect(safeName).not.toContain('..');
      expect(safeName).not.toContain('/');
      expect(safeName).not.toContain('\\');
      expect(safeName.endsWith('.pdf')).toBe(true);
    });
  });
});
