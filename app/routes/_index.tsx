import type { MetaFunction } from "@remix-run/node";
import { IconBrandGithub } from "@tabler/icons-react";

import Nostr from "~/components/Nostr";

export const meta: MetaFunction = () => {
	return [
		{ title: "Nostrasia Timeline" },
		{ name: "description", content: "Nostrasia" },
	];
};

export default function Index() {
	return (
		<div className="w-dvw h-dvh overflow-hidden flex justify-center items-center p-5 bg-gray-300 relative">
			<div className="w-11/12 lg:w-2/3">
				<Nostr />
			</div>
			<div className="absolute bottom-3 right-3 text-md text-gray-500">
				<a href="https://github.com/darashi/nostrasia">
					<IconBrandGithub />
				</a>
			</div>
		</div>
	);
}
