import type * as Nostr from 'nostr-typedef';
import { format, formatDistance } from 'date-fns';
import { nip19 } from 'nostr-tools';

type Props = {
	event: Nostr.Event;
	profiles: Record<string, Nostr.Content.Metadata>;
	currentTime: Date;
};

export default function Note({ event, profiles, currentTime }: Props) {
	const content = event.content;
	const createdAt = new Date(event.created_at * 1000);
	const time = format(createdAt, 'yyyy-MM-dd HH:mm:ss');
	const relativeTime = formatDistance(createdAt, currentTime, {
		addSuffix: true,
	});

	const metadata = profiles[event.pubkey];
	const name = metadata?.display_name || metadata?.name;
	const npub = nip19.npubEncode(event.pubkey);
	const pictureUrl = metadata?.picture;

	return (
		<div className="card h-full w-full overflow-hidden rounded-[0.1rem] border-y border-base-content text-base-content backdrop-blur-[30px]">
			<div className="card-body px-5 py-12 lg:px-10 lg:py-16">
				<div className="flex items-center">
					<div className="flex-none">
						{pictureUrl ? (
							<img
								className="h-12 w-12 rounded-full object-cover aspect-square lg:h-32 lg:w-32"
								alt=""
								key={pictureUrl}
								src={pictureUrl}
							/>
						) : (
							<div className="avatar placeholder">
								<div className="bg-neutral h-12 w-12 rounded-full lg:h-32 lg:w-32" />
							</div>
						)}
					</div>
					<div className="mx-3 min-w-0 max-w-full lg:mx-6">
						<div>
							{name ? (
								<div className="overflow-hidden text-ellipsis text-lg font-bold leading-tight lg:text-4xl lg:leading-tight">
									{name}
								</div>
							) : (
								<div className="overflow-hidden text-ellipsis text-lg font-bold leading-tight text-base-content/70 lg:text-4xl lg:leading-tight">
									{npub}
								</div>
							)}
							<div className="text-sm text-base-content/70 lg:mt-5 lg:text-3xl">
								{time} ({relativeTime})
							</div>
						</div>
					</div>
				</div>

				<div className="mt-5 break-words whitespace-pre-wrap lg:mt-10">
					<p className="line-clamp-5 text-lg leading-relaxed lg:text-5xl lg:leading-relaxed">
						{content}
					</p>
				</div>
			</div>
		</div>
	);
}
