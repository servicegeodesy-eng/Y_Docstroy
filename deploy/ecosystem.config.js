module.exports = {
  apps: [
    {
      name: "docstroy-api",
      script: "./server/dist/index.js",
      cwd: "/var/www/docstroy",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/docstroy/error.log",
      out_file: "/var/log/docstroy/out.log",
      merge_logs: true,
    },
  ],
};
