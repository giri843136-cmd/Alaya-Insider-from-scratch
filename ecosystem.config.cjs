// PM2 config tuned for memory-constrained hosting (Hostinger shared/Cloud).
// Restart the process before the host's OOM killer does, so LiteSpeed
// never sees a dead backend (that's what causes the 503s).
//
// Usage: pm2 start ecosystem.config.cjs && pm2 save

module.exports = {
  apps: [
    {
      name: 'alayainsider',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Cap Node.js heap to 200MB — prevents runaway memory growth.
        // Node.js can use ~30% more than this for native buffers,
        // keeping total RSS well under 300MB.
        NODE_OPTIONS: '--max-old-space-size=200',
      },
      // Restart if RSS exceeds this — set below your plan's memory limit.
      // Hostinger shared plans: keep at ~50-60% of your allowed RAM.
      // With revalidate caching, RSS should stay well under 200MB.
      max_memory_restart: '256M',
      // Don't burn CPU/RAM on restart storms
      exp_backoff_restart_delay: 200,
      max_restarts: 20,
      restart_delay: 2000,
      // Kill with SIGINT first so Next.js shuts down cleanly
      kill_timeout: 5000,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
