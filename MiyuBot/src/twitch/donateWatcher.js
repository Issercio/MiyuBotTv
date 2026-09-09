const { DONATE_TEXT } = require("./donateText");

function createDonateWatcher({
	config,
	queue,
	isLive
}) {
	let timer = null;
	let wasLive = false;
	let lastAnnouncedAt = 0;

	async function tick() {
		if (!config.donateAnnounceEnabled) {
			return;
		}

		const live = typeof isLive === "function" && isLive();

		if (!live) {
			wasLive = false;
			return;
		}

		const now = Date.now();

		if (!wasLive) {
			wasLive = true;
			lastAnnouncedAt = now;
			return;
		}

		if (now - lastAnnouncedAt < config.donateIntervalMs) {
			return;
		}

		lastAnnouncedAt = now;

		try {
			await queue.announce(`#${config.channel}`, DONATE_TEXT);
		} catch (error) {
			console.warn(
				"[TWITCH] Annonce don :",
				error.message || error
			);
		}
	}

	function start() {
		if (!config.donateAnnounceEnabled) {
			return;
		}

		if (timer) {
			return;
		}

		tick();
		timer = setInterval(tick, 30000);

		if (typeof timer.unref === "function") {
			timer.unref();
		}
	}

	function stop() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}

		wasLive = false;
	}

	return {
		start,
		stop
	};
}

module.exports = {
	createDonateWatcher
};
