import streams, { Address } from '../streams-lib/wasm-node/iota_streams_wasm';
// import fetch from 'node-fetch';

// global.fetch = fetch as any;
// global.Headers = (fetch as any).Headers;
// global.Request = (fetch as any).Request;
// global.Response = (fetch as any).Response;

streams.set_panic_hook();

export class StreamsService {
	node = 'https://api.lb-0.testnet.chrysalis2.com/';
	tmpAuth: streams.Author;
	tmpSub: streams.Subscriber;

	create = async (seed?: string): Promise<{ seed: string; announcementLink: string }> => {
		const options = new streams.SendOptions(1, true, 1);
		if (!seed) {
			seed = this.makeSeed(81);
		}
		this.tmpAuth = new streams.Author(this.node, seed, options, false);
		console.log('channel address: ', this.tmpAuth.channel_address());
		console.log('multi branching: ', this.tmpAuth.is_multi_branching());

		const response = await this.tmpAuth.clone().send_announce();
		const ann_link = response.get_link();
		console.log('announced at: ', ann_link.to_string());
		return {
			seed,
			announcementLink: ann_link.to_string()
		};
	};

	addLogs = async (address: string, publicPayload: string, maskedPayload: string, isAuth: boolean): Promise<{ resLink: string; payload: string }> => {
		const keyloadLink = Address.from_string(address);
		const pPayload: any = this.toBytes(publicPayload);
		const mPayload: any = this.toBytes(maskedPayload);

		console.log('Author Sending tagged packet');
		let response: any = null;

		// TODO
		if (isAuth) {
			response = await this.tmpAuth.clone().send_tagged_packet(keyloadLink, pPayload, mPayload);
		} else {
			response = await this.tmpSub.clone().send_tagged_packet(keyloadLink, pPayload, mPayload);
		}

		const tag_link = response.get_link();
		console.log('Tag packet at: ', tag_link.to_string());

		return {
			resLink: tag_link.to_string(),
			payload: ''
		};
	};

	getLogs = async (isAuth: boolean): Promise<{ publicData: any; maskedData: any }> => {
		console.log('\nAuthor fetching next messages', this.tmpAuth);
		let exists = true;
		let publicData: string[] = [];
		let maskedData: string[] = [];
		while (exists) {
			let next_msgs: any = [];

			// TODO
			if (isAuth) {
				next_msgs = await this.tmpAuth.clone().fetch_next_msgs();
			} else {
				next_msgs = await this.tmpAuth.clone().fetch_next_msgs();
			}

			if (next_msgs.length === 0) {
				exists = false;
			}

			for (let i = 0; i < next_msgs.length; i++) {
				console.log('Found a message...');
				const pubPayload = next_msgs[i].get_message().get_public_payload();
				const maskedPayload = next_msgs[i].get_message().get_masked_payload();
				console.log('Public: ', this.fromBytes(pubPayload), '\tMasked: ', this.fromBytes(maskedPayload));
				publicData = [...publicData, this.fromBytes(pubPayload)];
				maskedData = [...maskedData, this.fromBytes(maskedPayload)];
			}
		}

		return {
			publicData,
			maskedData
		};
	};

	getSubscriptions = async (announcementLink: string): Promise<void> => {};

	requestSubscription = async (announcementLink: string, seed?: string): Promise<{ seed: string; subLink: string }> => {
		const annAddress = streams.Address.from_string(announcementLink);
		const options = new streams.SendOptions(1, true, 1);

		if (!seed) {
			seed = this.makeSeed(81);
		}

		this.tmpSub = new streams.Subscriber(this.node, seed, options);
		let ann_link_copy = annAddress.copy();
		await this.tmpSub.clone().receive_announcement(ann_link_copy);

		console.log('Subscribing...');
		ann_link_copy = annAddress.copy();
		const response = await this.tmpSub.clone().send_subscribe(ann_link_copy);
		const sub_link = response.get_link();
		console.log('Subscription message at: ', sub_link.to_string());
		return { seed, subLink: sub_link };

		console.log('Subscription processed');
	};

	authorizeSubscription = async (subscriptionLink: string, announcementLink: string): Promise<void> => {
		const subscriptionAddress = streams.Address.from_string(subscriptionLink);
		const announcementAddress = streams.Address.from_string(announcementLink);
		console.log('Subscription message at: ', subscriptionLink);
		console.log('For channel at: ', announcementLink);
		await this.tmpAuth.clone().receive_subscribe(subscriptionAddress);

		console.log('Sending Keyload');
		const response = await this.tmpAuth.clone().send_keyload_for_everyone(announcementAddress);
		const keyload_link = response.get_link();
		console.log('Keyload message at: ', keyload_link.to_string());
	};

	async callMain() {
		await main()
			.then(() => {
				console.log('Done example');
			})
			.catch((err) => {
				console.log(err);
			});
	}

	// TODO moveToLib
	toBytes(str: string) {
		const bytes = [];
		for (let i = 0; i < str.length; ++i) {
			bytes.push(str.charCodeAt(i));
		}
		return bytes;
	}

	fromBytes(bytes: any) {
		let str = '';
		for (let i = 0; i < bytes.length; ++i) {
			str += String.fromCharCode(bytes[i]);
		}
		return str;
	}

	makeSeed(size: number) {
		const alphabet = 'abcdefghijklmnopqrstuvwxyz';
		let seed = '';
		for (let i = 9; i < size; i++) {
			seed += alphabet[Math.floor(Math.random() * alphabet.length)];
		}
		return seed;
	}
}

export async function main() {
	const node = 'https://api.lb-0.testnet.chrysalis2.com/';
	const options = new streams.SendOptions(9, true, 1);
	const seed = make_seed(81);
	const auth = new streams.Author(node, seed, options.clone(), false);

	console.log('channel address: ', auth.channel_address());
	console.log('multi branching: ', auth.is_multi_branching());

	let response = await auth.clone().send_announce();
	const ann_link = response.get_link();
	console.log('announced at: ', ann_link.to_string());

	const seed2 = make_seed(81);
	const sub = new streams.Subscriber(node, seed2, options.clone());
	let ann_link_copy = ann_link.copy();
	await sub.clone().receive_announcement(ann_link_copy);

	console.log('Subscribing...');
	ann_link_copy = ann_link.copy();
	response = await sub.clone().send_subscribe(ann_link_copy);
	const sub_link = response.get_link();
	console.log('Subscription message at: ', sub_link.to_string());
	await auth.clone().receive_subscribe(sub_link);
	console.log('Subscription processed');

	console.log('Sending Keyload');
	response = await auth.clone().send_keyload_for_everyone(ann_link);
	const keyload_link = response.get_link();
	console.log('Keyload message at: ', keyload_link.to_string());

	console.log('Subscriber syncing...');
	await sub.clone().sync_state();

	const public_payload = to_bytes('Public');
	const masked_payload = to_bytes('Masked');

	console.log('Subscriber Sending tagged packet');
	response = await sub.clone().send_tagged_packet(keyload_link, public_payload, masked_payload);
	const tag_link = response.get_link();
	console.log('Tag packet at: ', tag_link.to_string());

	let last_link = tag_link;
	console.log('Subscriber Sending multiple signed packets');

	for (let x = 0; x < 10; x++) {
		response = await sub.clone().send_signed_packet(last_link, public_payload, masked_payload);
		last_link = response.get_link();
		console.log('Signed packet at: ', last_link.to_string());
	}

	console.log('\nAuthor fetching next messages');
	let exists = true;
	while (exists) {
		const next_msgs = await auth.clone().fetch_next_msgs();

		if (next_msgs.length === 0) {
			exists = false;
		}

		for (let i = 0; i < next_msgs.length; i++) {
			console.log('Found a message...');
			console.log(
				'Public: ',
				from_bytes(next_msgs[i].get_message().get_public_payload()),
				'\tMasked: ',
				from_bytes(next_msgs[i].get_message().get_masked_payload())
			);
		}
	}

	// Import export example
	// TODO: Use stronghold
	const password = 'password';
	const exp = auth.clone().export(password);

	const client = new streams.Client(node, options.clone());
	const auth2 = streams.Author.import(client, exp, password);

	if (auth2.channel_address !== auth.channel_address) {
		console.log('import failed');
	} else {
		console.log('import succesfull');
	}

	function to_bytes(str: string) {
		const bytes = new Uint8Array(str.length);
		for (let i = 0; i < str.length; ++i) {
			bytes[i] = str.charCodeAt(i);
		}
		return bytes;
	}

	function from_bytes(bytes: any) {
		let str = '';
		for (let i = 0; i < bytes.length; ++i) {
			str += String.fromCharCode(bytes[i]);
		}
		return str;
	}

	function make_seed(size: number) {
		const alphabet = 'abcdefghijklmnopqrstuvwxyz';
		let seed = '';
		for (let i = 9; i < size; i++) {
			seed += alphabet[Math.floor(Math.random() * alphabet.length)];
		}
		return seed;
	}
}
