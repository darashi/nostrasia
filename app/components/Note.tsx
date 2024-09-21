import type * as Nostr from "nostr-typedef";
import { format, formatDistance } from "date-fns";
import { nip19 } from "nostr-tools";

type Props = {
	event: Nostr.Event;
	profiles: Record<string, Nostr.Content.Metadata>;
	currentTime: Date;
};

export default function Note({ event, profiles, currentTime }: Props) {
	const content = event.content;
	const d = new Date(event.created_at * 1000);
	const time = format(d, "yyyy-MM-dd HH:mm:ss");
	const relativeTime = formatDistance(d, currentTime, {
		addSuffix: true,
	});

	const metadata = profiles[event.pubkey];
	const name = metadata?.display_name || metadata?.name;
	const npub = nip19.npubEncode(event.pubkey);
	const pictureUrl = metadata?.picture;

	return (
		<div className="w-full h-full card card-bordered shadow-xl bg-white">
			<div className="card-body">
				<div className="flex items-center">
					<div className="flex-none">
						{pictureUrl ? (
							<img
								className="w-32 h-32 w-max-32 h-max-32 rounded-full object-cover"
								alt=""
								src={pictureUrl}
							/>
						) : (
							<div className="avatar placeholder">
								<div className="bg-neutral w-32 rounded-full" />
							</div>
						)}
					</div>
					<div className="mx-6 min-w-0 max-w-full">
						<div>
							{name ? (
								<div className="leading-relaxed overflow-hidden text-ellipsis text-5xl">
									{name}
								</div>
							) : (
								<div className="leading-relaxed overflow-hidden text-ellipsis text-gray-500 text-5xl">
									{npub}
								</div>
							)}
							<div className="text-3xl text-gray-500">
								{time} ({relativeTime})
							</div>
						</div>
					</div>
				</div>

				<div className="mt-10 break-words whitespace-pre-wrap">
					<p className="text-6xl line-clamp-5 leading-snug">{content}</p>
				</div>
			</div>
		</div>
	);
}
