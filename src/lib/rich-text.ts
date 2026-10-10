import sanitizeHtml from 'sanitize-html';

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'sub', 'sup'],
    allowedAttributes: {
      '*': ['class'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      div: ['class', 'data-src', 'data-max-play'],
      td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  });
}
