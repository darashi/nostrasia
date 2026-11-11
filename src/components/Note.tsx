import { useState } from 'react';
import type * as Nostr from 'nostr-typedef';
import { format, formatDistance } from 'date-fns';
import { nip19 } from 'nostr-tools';

type Props = {
	event: Nostr.Event;
	profiles: Record<string, Nostr.Content.Metadata>;
	currentTime: Date;
	// Load the avatar with CORS so it can be drawn by HTML-in-Canvas, which
	// leaves out cross-origin images that are not CORS-enabled.
	corsImages?: boolean;
};

export default function Note({ event, profiles, currentTime, corsImages = false }: Props) {
	const [failedPicture, setFailedPicture] = useState<string | null>(null);
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
		<div className="relative h-full w-full border-[3px] border-ink bg-paper text-ink shadow-[8px_8px_0_var(--color-ink)]">
			<div className="flex h-2 border-b-[3px] border-ink lg:h-3" aria-hidden="true">
				<span className="flex-1 bg-pu" />
				<span className="flex-1 bg-or" />
				<span className="flex-1 bg-ye" />
				<span className="flex-1 bg-te" />
			</div>
			<div className="px-5 py-8 lg:px-10 lg:py-12">
				<div className="flex items-center">
					<div className="flex-none">
						{pictureUrl && pictureUrl !== failedPicture ? (
							<img
								crossOrigin={corsImages ? 'anonymous' : undefined}
								onError={() => setFailedPicture(pictureUrl)}
								className="aspect-square h-12 w-12 rounded-full border-[3px] border-ink object-cover lg:h-32 lg:w-32"
								alt=""
								key={pictureUrl}
								src={pictureUrl}
							/>
						) : (
							<div
								className="h-12 w-12 rounded-full border-[3px] border-ink lg:h-32 lg:w-32"
								style={{ backgroundColor: `#${event.pubkey.slice(0, 6)}` }}
							/>
						)}
					</div>
					<div className="mx-3 min-w-0 max-w-full lg:mx-6">
						{name ? (
							<div className="overflow-hidden text-ellipsis font-ja text-lg font-black leading-tight lg:text-4xl lg:leading-tight">
								{name}
							</div>
						) : (
							<div className="overflow-hidden text-ellipsis font-en text-lg font-semibold leading-tight text-mute lg:text-3xl lg:leading-tight">
								{npub}
							</div>
						)}
						<div className="mt-1 border-t-[3px] border-ink pt-1 font-en text-xs font-semibold tracking-[0.04em] text-mute lg:mt-4 lg:pt-3 lg:text-2xl">
							{time} <span className="whitespace-nowrap">({relativeTime})</span>
						</div>
					</div>
				</div>

				<div className="mt-5 break-words whitespace-pre-wrap lg:mt-10">
					<p className="line-clamp-5 font-ja text-lg font-bold leading-relaxed lg:text-5xl lg:leading-relaxed">
						{content}
					</p>
				</div>
			</div>
		</div>
	);
}
