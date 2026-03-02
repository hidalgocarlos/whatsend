// PM2 ecosystem — WhatSend producción
// Usar con: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'whatsend-api',
      script: 'src/index.js',
      instances: 1,           // 1 instancia: whatsapp-web.js no es compatible con cluster
      exec_mode: 'fork',
      max_memory_restart: '1G',
      restart_delay: 3000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/whatsend/error.log',
      out_file: '/var/log/whatsend/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true,
    },
  ],
};
