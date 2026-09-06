module.exports = {
	apps: [
		{
			name: "miyubot",
			script: "src/index.js",
			cwd: ".",
			instances: 1,
			exec_mode: "fork",
			autorestart: true,
			watch: false,
			max_memory_restart: "700M",
			min_uptime: "10s",
			exp_backoff_restart_delay: 100,
			restart_delay: 3000,
			kill_timeout: 8000,
			env: {
				NODE_ENV: "production"
			},
			out_file: "./logs/out.log",
			error_file: "./logs/error.log",
			merge_logs: true,
			time: true
		}
	]
};
