const testUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:lentera-qa-only@127.0.0.1:55432/lentera_qa';
const parsed = new URL(testUrl);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.port !== '55432' || parsed.pathname !== '/lentera_qa') {
  throw new Error('Integration tests require the isolated local QA database on port 55432');
}
process.env.DATABASE_URL = testUrl;
