import { Type } from '@sinclair/typebox';

export const TopicSchema = Type.Object({
	type: Type.String(),
	source: Type.String()
});

export const ChannelInfoSchema = Type.Object({
	channelAddress: Type.String({ minLength: 10 }), // TODO clarify exact length of channelAddresse to validate them in the schema when starting with the streams integration!
	author: Type.String(),
	subscribers: Type.Optional(Type.Array(Type.String())),
	latestLink: Type.String(),
	topics: Type.Array(TopicSchema),
	created: Type.Optional(Type.String()),
	latestMessage: Type.Optional(Type.String())
});
