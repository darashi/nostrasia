import { useCallback, useEffect, useRef, useState } from "react";
import {
	createRxNostr,
	createRxForwardReq,
	uniq,
	createRxBackwardReq,
	latestEach,
	type EventPacket,
} from "rx-nostr";
import { verifier } from "rx-nostr-crypto";
import type * as Nostr from "nostr-typedef";

import Note from "./Note";

const searchRelays = [
	"wss://search.nos.today",
	"wss://relay.nostr.band",
	"wss://relay.noswhere.com",
];
const profileRelays = [
	"wss://nos.lol",
	"wss://yabu.me",
	"wss://relay.damus.io",
];
const tickInterval = 5_000;
const notesBufferSize = 20;
const queries = ["nostrasia", "のすあじ", "ノスアジ"];

export default function NostrView() {
	const profileReqRef = useRef<ReturnType<typeof createRxBackwardReq>>();
	const rxNostrRef = useRef<ReturnType<typeof createRxNostr>>();
	const [event, setEvent] = useState<Nostr.Event | null>(null);
	const [events, setEvents] = useState<Nostr.Event[]>([]);
	const [profiles, setProfiles] = useState<
		Record<string, Nostr.Content.Metadata>
	>({});
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
			.subscribe(({ event }) => {
				if (!profiles[event.pubkey]) {
					profileReqRef.current?.emit({
						kinds: [0],
						authors: [event.pubkey],
						limit: 1,
					});
				}
				setEvents((prev) => {
					if (prev.some((e) => e.id === event.id)) {
						return prev;
					}

					const newEvents = [event, ...prev];
					newEvents.sort((a, b) => b.created_at - a.created_at);
					newEvents.splice(notesBufferSize);

					if (prev.length === 0) {
						setEvent(event);
					}
					return newEvents;
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
			.pipe(latestEach(({ event }) => event.pubkey))
			.subscribe((packet: EventPacket) => {
				const { event } = packet;
				const profile = JSON.parse(event.content);
				setProfiles((prev) => ({ ...prev, [event.pubkey]: profile }));
				// TODO truncate profiles to vaoid memory leak
			});

		return () => {
			profileSubscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		const interval = setInterval(() => {
			setTick((prev) => prev + 1);
			setCurrentTime(new Date());
		}, tickInterval);

		return () => {
			clearInterval(interval);
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: this reacts to tick
	useEffect(() => {
		if (events.length === 0) {
			return;
		}

		// find the next event to display. neweset first.
		let next = events.find((e) => !displayed[e.id]);
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
