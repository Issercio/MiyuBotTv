const http = require("http");

const startedAt = Date.now();

let statusProvider = () => ({});

function setHealthStatusProvider(provider) {
	statusProvider = typeof provider === "function"
		? provider
		: () => ({});
}

function startHealthServer() {
	const port = Number(process.env.PORT || 3000);
	const host = process.env.HOST || "0.0.0.0";

	const server = http.createServer((request, response) => {
		const url = String(request.url || "/").split("?")[0];

		if (url !== "/" && url !== "/health") {
			response.writeHead(404, {
				"Content-Type": "application/json"
			});
			response.end(JSON.stringify({
				ok: false
			}));
			return;
		}

		const extra = statusProvider();

		response.writeHead(200, {
			"Content-Type": "application/json"
		});
		response.end(JSON.stringify({
			ok: true,
			service: "miyubot",
			uptime_ms: Date.now() - startedAt,
			...extra
		}));
	});

	server.listen(port, host, () => {
		console.log(
			`[HEALTH] Disponible sur http://${host}:${port}/health`
		);
	});

	return server;
}

module.exports = {
	startHealthServer,
	setHealthStatusProvider
};
