function tagValue(tags, ...keys) {
	const source = tags || {};

	for (const key of keys) {
		if (source[key] != null && source[key] !== "") {
			return source[key];
		}
	}

	return "";
}

function isForeignSharedChat(tags) {
	const roomId = String(tagValue(tags, "room-id", "roomId"));
	const sourceRoomId = String(tagValue(tags, "source-room-id", "sourceRoomId"));

	if (!roomId || !sourceRoomId) {
		return false;
	}

	return sourceRoomId !== roomId;
}

function sourceBadgeHas(tags, name) {
	const badges = (tags && tags.badges) || {};

	if (badges[name]) {
		return true;
	}

	const raw = tagValue(tags, "source-badges", "sourceBadges");

	if (raw && typeof raw === "object") {
		return Boolean(raw[name]);
	}

	return String(raw)
		.split(",")
		.some((part) => part.startsWith(`${name}/`));
}

function isSharedChatStreamer(tags) {
	return sourceBadgeHas(tags, "broadcaster");
}

module.exports = {
	isForeignSharedChat,
	isSharedChatStreamer
};
