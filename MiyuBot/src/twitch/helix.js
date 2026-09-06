const https = require("https");

function requestJson({
	method,
	hostname,
	path,
	headers,
	body
}) {
	return new Promise((resolve, reject) => {
		const request = https.request(
			{
				method,
				hostname,
				path,
				headers
			},
			(response) => {
				let data = "";

				response.on("data", (chunk) => {
					data += chunk;
				});

				response.on("end", () => {
					if (!data) {
						resolve({
							status: response.statusCode,
							json: {}
						});
						return;
					}

					try {
						resolve({
							status: response.statusCode,
							json: JSON.parse(data)
						});
					} catch (error) {
						reject(error);
					}
				});
			}
		);

		request.setTimeout(8000, () => {
			request.destroy(new Error("Helix timeout"));
		});

		request.on("error", reject);

		if (body) {
			request.write(body);
		}

		request.end();
	});
}

function createHelix(config) {
	let appToken = "";
	let tokenExpiresAt = 0;

	async function getAppToken() {
		if (!config.clientId || !config.clientSecret) {
			return "";
		}

		if (appToken && Date.now() < tokenExpiresAt - 60000) {
			return appToken;
		}

		const body = new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			grant_type: "client_credentials"
		}).toString();

		const result = await requestJson({
			method: "POST",
			hostname: "id.twitch.tv",
			path: "/oauth2/token",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Content-Length": Buffer.byteLength(body)
			},
			body
		});

		if (result.status !== 200 || !result.json.access_token) {
			throw new Error("Impossible d'obtenir un token Helix Twitch");
		}

		appToken = result.json.access_token;
		tokenExpiresAt = Date.now() + (Number(result.json.expires_in) || 3600) * 1000;

		return appToken;
	}

	async function helixGet(path, { userToken = "" } = {}) {
		const token = userToken || await getAppToken();

		if (!token) {
			return null;
		}

		const result = await requestJson({
			method: "GET",
			hostname: "api.twitch.tv",
			path,
			headers: {
				"Client-Id": config.clientId,
				Authorization: `Bearer ${token}`
			}
		});

		if (result.status !== 200) {
			return {
				ok: false,
				status: result.status,
				json: result.json
			};
		}

		return {
			ok: true,
			status: result.status,
			json: result.json
		};
	}

	async function helixData(path, options) {
		const result = await helixGet(path, options);

		if (!result || !result.ok) {
			return null;
		}

		return result.json;
	}

	async function getUser(login) {
		const data = await helixData(
			`/helix/users?login=${encodeURIComponent(String(login).toLowerCase())}`
		);

		return data && Array.isArray(data.data) ? data.data[0] || null : null;
	}

	async function getStream(login) {
		const data = await helixData(
			`/helix/streams?user_login=${encodeURIComponent(String(login).toLowerCase())}`
		);

		return data && Array.isArray(data.data) ? data.data[0] || null : null;
	}

	async function getChannel(broadcasterId) {
		if (!broadcasterId) {
			return null;
		}

		const data = await helixData(
			`/helix/channels?broadcaster_id=${encodeURIComponent(broadcasterId)}`
		);

		return data && Array.isArray(data.data) ? data.data[0] || null : null;
	}

	async function getGame(gameId) {
		if (!gameId) {
			return null;
		}

		const data = await helixData(
			`/helix/games?id=${encodeURIComponent(gameId)}`
		);

		return data && Array.isArray(data.data) ? data.data[0] || null : null;
	}

	function adsUserToken() {
		if (config.adsToken) {
			return config.adsToken;
		}

		if (
			String(config.username || "").toLowerCase() ===
			String(config.channel || "").toLowerCase()
		) {
			return String(config.oauthToken || "").replace(/^oauth:/i, "");
		}

		return "";
	}

	async function getAdSchedule(broadcasterId) {
		if (!broadcasterId) {
			return null;
		}

		const userToken = adsUserToken();
		const result = await helixGet(
			`/helix/channels/ads?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
			userToken ? { userToken } : {}
		);

		if (!result || !result.ok) {
			return {
				ok: false,
				status: result?.status || 0
			};
		}

		return {
			ok: true,
			schedule:
				result.json && Array.isArray(result.json.data)
					? result.json.data[0] || null
					: null
		};
	}

	function formatUptime(startedAt) {
		const start = new Date(startedAt).getTime();

		if (!Number.isFinite(start)) {
			return "inconnu";
		}

		const totalSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}

		return `${minutes}m`;
	}

	return {
		available: Boolean(config.clientId && config.clientSecret),
		getUser,
		getStream,
		getChannel,
		getGame,
		getAdSchedule,
		formatUptime
	};
}

module.exports = {
	createHelix
};
