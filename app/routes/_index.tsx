import type { MetaFunction } from "@remix-run/node";
import Nostr from "~/components/Nostr";

export const meta: MetaFunction = () => {
	return [
		{ title: "Nostrasia 2024 Timeline" },
		{ name: "description", content: "Nostrasia 2024" },
	];
};

export default function Index() {
	return (
		<div className="w-dvw h-dvh overflow-hidden flex justify-center items-center p-5 bg-gray-300">
			<div className="w-11/12">
				<Nostr />
			</div>
		</div>
	);
}
