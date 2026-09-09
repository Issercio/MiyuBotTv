const SAY_TIMEOUT_MS = 4000;

function withTimeout(promise, ms, label) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(label)), ms);

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

function createChatQueue(client, delayMs, sendPreferred, sendAnnouncement) {
	let chain = Promise.resolve();
	let lastSentAt = 0;

	function enqueue(task) {
		chain = chain
			.then(async () => {
				const wait = delayMs - (Date.now() - lastSentAt);

				if (wait > 0) {
					await new Promise((resolve) => setTimeout(resolve, wait));
				}

				lastSentAt = Date.now();
				return task();
			})
			.catch((error) => {
				console.error("[TWITCH] File d'envoi chat :", error.message || error);
			});

		return chain;
	}

	function say(channel, message) {
		const text = String(message || "").trim().slice(0, 490);

		if (!text) {
			return Promise.resolve(false);
		}

		return enqueue(async () => {
			if (typeof sendPreferred === "function") {
				const sent = await sendPreferred(text);

				if (sent) {
					return true;
				}
			}

			await withTimeout(
				Promise.resolve(client.say(channel, text)),
				SAY_TIMEOUT_MS,
				"chat say timeout"
			);
			return true;
		});
	}

	function announce(channel, message) {
		const text = String(message || "").trim().slice(0, 500);

		if (!text) {
			return Promise.resolve(false);
		}

		return enqueue(async () => {
			if (typeof sendAnnouncement === "function") {
				const sent = await sendAnnouncement(text);

				if (sent) {
					return true;
				}
			}

			if (typeof sendPreferred === "function") {
				const sent = await sendPreferred(text);

				if (sent) {
					return true;
				}
			}

			await withTimeout(
				Promise.resolve(client.say(channel, text)),
				SAY_TIMEOUT_MS,
				"chat say timeout"
			);
			return true;
		});
	}

	return {
		say,
		announce
	};
}

module.exports = {
	createChatQueue
};
