module.exports = {
  apps: [
    {
      name: 'lenterabelajar',
      script: '.next/standalone/server.js',
      instances: Number(process.env.WEB_CONCURRENCY || 2),
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1800M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
    },
    {
      name: 'lenterabelajar-cbt-worker',
      script: 'scripts/cbt-worker.cjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production', INTERNAL_APP_URL: 'http://127.0.0.1:3000' },
    },
  ],
};
