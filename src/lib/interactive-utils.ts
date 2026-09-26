export interface ParsedInteractiveContent {
  url: string;
  embedCode: string;
  platform: string;
}

export function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('h5p')) return 'H5P';
  if (lower.includes('lumi')) return 'Lumi';
  if (lower.includes('kahoot')) return 'Kahoot';
  if (lower.includes('quizizz')) return 'Quizizz';
  if (lower.includes('wordwall')) return 'Wordwall';
  if (lower.includes('canva')) return 'Canva';
  if (lower.includes('phet.colorado.edu')) return 'PhET';
  if (lower.includes('geogebra')) return 'GeoGebra';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('docs.google.com') || lower.includes('forms.gle')) return 'Google';
  if (lower.includes('padlet')) return 'Padlet';
  if (lower.includes('scratch.mit.edu')) return 'Scratch';
  return 'Web / Interactive';
}

export function normalizeInteractiveUrl(rawUrl: string): string {
  let url = rawUrl.trim();

  // YouTube normalization to embed
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('watch?v=')[1]?.split('&')[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }

  // Wordwall normalization to embed
  if (url.includes('wordwall.net/resource/')) {
    url = url.replace('wordwall.net/resource/', 'wordwall.net/embed/');
  }

  // Google Slides presentation /edit to /embed
  if (url.includes('docs.google.com/presentation/d/') && url.includes('/edit')) {
    url = url.replace(/\/edit.*$/, '/embed');
  }

  return url;
}

export function parseInteractiveContent(input: string): ParsedInteractiveContent {
  const trimmed = input.trim();

  // Check if input contains an iframe tag
  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (iframeMatch && iframeMatch[1]) {
    const extractedUrl = normalizeInteractiveUrl(iframeMatch[1]);
    return {
      url: extractedUrl,
      embedCode: trimmed,
      platform: detectPlatform(extractedUrl),
    };
  }

  // If it's a URL
  const normalizedUrl = normalizeInteractiveUrl(trimmed);
  return {
    url: normalizedUrl,
    embedCode: `<iframe src="${normalizedUrl}" allow="fullscreen; autoplay; clipboard-write" allowfullscreen class="w-full h-full border-0"></iframe>`,
    platform: detectPlatform(normalizedUrl),
  };
}
