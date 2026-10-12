import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  normalizeInteractiveUrl,
  parseInteractiveContent,
} from '@/lib/interactive-utils';

describe('Interactive Learning Content & Embed Handling', () => {
  describe('Platform Detection', () => {
    it('identifies known educational and multimedia platforms', () => {
      const cases: Array<[string, string]> = [
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YouTube'],
        ['https://youtu.be/dQw4w9WgXcQ', 'YouTube'],
        ['https://kahoot.it/challenge/12345', 'Kahoot'],
        ['https://quizizz.com/join?gc=123456', 'Quizizz'],
        ['https://wordwall.net/resource/12345', 'Wordwall'],
        ['https://phet.colorado.edu/sims/html/forces/latest/forces_en.html', 'PhET'],
        ['https://www.geogebra.org/m/abc1234', 'GeoGebra'],
        ['https://docs.google.com/presentation/d/123/edit', 'Google'],
        ['https://forms.gle/xyz123', 'Google'],
        ['https://canva.com/design/DAE123', 'Canva'],
        ['https://scratch.mit.edu/projects/12345678/', 'Scratch'],
        ['https://padlet.com/user/board', 'Padlet'],
        ['https://example.com/interactive-lab', 'Web / Interactive'],
      ];

      for (const [url, expectedPlatform] of cases) {
        expect(detectPlatform(url)).toBe(expectedPlatform);
      }
    });
  });

  describe('Interactive URL Normalization', () => {
    it('converts standard YouTube watch URLs to embed format', () => {
      const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s';
      expect(normalizeInteractiveUrl(input)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('converts shortened youtu.be URLs to embed format', () => {
      const input = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef';
      expect(normalizeInteractiveUrl(input)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('converts Wordwall resource links to embed format', () => {
      const input = 'https://wordwall.net/resource/12345/matematika';
      expect(normalizeInteractiveUrl(input)).toBe('https://wordwall.net/embed/12345/matematika');
    });

    it('converts Google Slides edit URLs to embed format', () => {
      const input = 'https://docs.google.com/presentation/d/12345abcd/edit?usp=sharing';
      expect(normalizeInteractiveUrl(input)).toBe('https://docs.google.com/presentation/d/12345abcd/embed');
    });

    it('preserves URLs that do not require transformation', () => {
      const input = 'https://phet.colorado.edu/sims/html/fractions/latest/fractions_en.html';
      expect(normalizeInteractiveUrl(input)).toBe(input);
    });
  });

  describe('Interactive Content Parsing', () => {
    it('wraps plain URL into an iframe and identifies platform', () => {
      const input = 'https://wordwall.net/resource/999';
      const parsed = parseInteractiveContent(input);

      expect(parsed.platform).toBe('Wordwall');
      expect(parsed.url).toBe('https://wordwall.net/embed/999');
      expect(parsed.embedCode).toContain('<iframe src="https://wordwall.net/embed/999"');
      expect(parsed.embedCode).toContain('allowfullscreen');
    });

    it('extracts and normalizes URL from raw iframe embed snippet', () => {
      const iframeSnippet = '<iframe width="560" height="315" src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" frameborder="0"></iframe><script>alert(1)</script>';
      const parsed = parseInteractiveContent(iframeSnippet);

      expect(parsed.platform).toBe('YouTube');
      expect(parsed.url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(parsed.embedCode).toContain('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
      expect(parsed.embedCode).not.toContain('<script>');
    });
  });
});
