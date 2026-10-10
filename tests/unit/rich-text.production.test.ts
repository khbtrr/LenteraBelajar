import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from '@/lib/rich-text';

describe('rich text used by lesson and quiz rendering', () => {
  it('keeps formatting while removing executable HTML and dangerous URLs', () => {
    const cleaned = sanitizeRichText('<p><strong>Lesson</strong><img src="/api/files/image.png" onerror="alert(1)"><a href="javascript:alert(1)">Link</a><script>alert(1)</script></p>');
    expect(cleaned).toContain('<strong>Lesson</strong>');
    expect(cleaned).toContain('/api/files/image.png');
    expect(cleaned).not.toMatch(/onerror|javascript:|<script/);
  });
});
