function createChatQueue(client, delayMs) {
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
			await client.say(channel, text);
			return true;
		});
	}

	return {
		say
	};
}

module.exports = {
	createChatQueue
};
