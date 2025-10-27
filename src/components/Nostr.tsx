import { useEffect, useRef, useState } from 'react';
import {
	createRxBackwardReq,
	createRxForwardReq,
	createRxNostr,
	latestEach,
	type EventPacket,
	uniq,
} from 'rx-nostr';
import { verifier } from 'rx-nostr-crypto';
import type * as Nostr from 'nostr-typedef';

import Note from './Note';

const searchRelays = [
	'wss://search.nos.today',
	'wss://relay.nostr.band',
	'wss://relay.noswhere.com',
];

const profileRelays = [
	'wss://nos.lol',
	'wss://yabu.me',
	'wss://relay.damus.io',
];

const tickInterval = 5_000;
const notesBufferSize = 20;
const queries = ['nostrasia', 'のすあじ', 'ノスアジ'];

export default function NostrView() {
	const profileReqRef = useRef<ReturnType<typeof createRxBackwardReq>>();
	const rxNostrRef = useRef<ReturnType<typeof createRxNostr>>();
	const [event, setEvent] = useState<Nostr.Event | null>(null);
	const [events, setEvents] = useState<Nostr.Event[]>([]);
	const [profiles, setProfiles] = useState<Record<string, Nostr.Content.Metadata>>({});
	const [displayed, setDisplayed] = useState<Record<string, Date>>({});
	const [currentTime, setCurrentTime] = useState<Date>(new Date());
	const [tick, setTick] = useState<number>(0);

	useEffect(() => {
		const rxNostr = createRxNostr({ verifier });
		rxNostrRef.current = rxNostr;

		return () => {
			rxNostr.dispose();
		};
	}, []);

	useEffect(() => {
		const rxReq = createRxForwardReq();
		const rxNostr = rxNostrRef.current;
		if (!rxNostr) {
			return;
		}

		const noteSubscription = rxNostr
			.use(rxReq, { on: { relays: searchRelays } })
			.pipe(uniq())
			.subscribe(({ event: nostrEvent }) => {
				if (!profiles[nostrEvent.pubkey]) {
					profileReqRef.current?.emit({
						kinds: [0],
						authors: [nostrEvent.pubkey],
						limit: 1,
					});
				}

				setEvents((prev) => {
					if (prev.some((existing) => existing.id === nostrEvent.id)) {
						return prev;
					}

					const updated = [nostrEvent, ...prev];
					updated.sort((a, b) => b.created_at - a.created_at);
					updated.splice(notesBufferSize);

					if (prev.length === 0) {
						setEvent(nostrEvent);
					}

					return updated;
				});
			});

		rxReq.emit(
			queries.map((query) => ({
				kinds: [1],
				limit: notesBufferSize,
				search: query,
			})),
		);

		return () => {
			noteSubscription.unsubscribe();
		};
	}, [profiles]);

	useEffect(() => {
		const rxNostr = rxNostrRef.current;
		if (!rxNostr) {
			return;
		}

		const profileReq = createRxBackwardReq();
		profileReqRef.current = profileReq;

		const profileSubscription = rxNostr
			.use(profileReq, { on: { relays: profileRelays } })
			.pipe(latestEach(({ event: nostrEvent }) => nostrEvent.pubkey))
			.subscribe((packet: EventPacket) => {
				const { event: nostrEvent } = packet;
				try {
					const profile = JSON.parse(nostrEvent.content) as Nostr.Content.Metadata;
					setProfiles((prev) => ({ ...prev, [nostrEvent.pubkey]: profile }));
				} catch {
					// Ignore malformed profile data.
				}
			});

		return () => {
			profileSubscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		const interval = window.setInterval(() => {
			setTick((prev) => prev + 1);
			setCurrentTime(new Date());
		}, tickInterval);

		return () => {
			clearInterval(interval);
		};
	}, []);

	// This effect intentionally depends only on tick to mimic the original timing behaviour.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (events.length === 0) {
			return;
		}

		let next = events.find((item) => !displayed[item.id]);
		if (!next) {
			setDisplayed({});
			next = events[0];
		}

		setDisplayed((prev) => ({ ...prev, [next.id]: new Date() }));
		setEvent(next);
	}, [tick]);

	if (event === null) {
		return (
			<div className="text-center">
				<span className="loading loading-dots loading-lg" />
			</div>
		);
	}

	return <Note event={event} profiles={profiles} currentTime={currentTime} />;
}
