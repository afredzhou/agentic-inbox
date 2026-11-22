// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, useKumoToastManager } from "@cloudflare/kumo";
import {
	CaretDownIcon,
	CaretUpIcon,
	LinkSimpleIcon,
	MagnifyingGlassIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import ContactAvatar from "~/components/ContactAvatar";
import { parseAddress } from "~/lib/contacts";
import { formatShortDate } from "~/lib/utils";
import {
	useContact,
	useMergeContact,
	useUnmergeContact,
} from "~/queries/contacts";
import { useUIStore } from "~/hooks/useUIStore";

interface ContactCardProps {
	mailboxId?: string;
	/** Address of the person whose message is being read. */
	senderEmail: string;
	senderName?: string | null;
}

/**
 * "Who is this?" card shown above a conversation: the contact's name and
 * domain, every address merged into them, and all of their conversations
 * across subjects/threads, so one customer reads as one customer.
 */
export default function ContactCard({
	mailboxId,
	senderEmail,
	senderName,
}: ContactCardProps) {
	const navigate = useNavigate();
	const toastManager = useKumoToastManager();
	const selectEmail = useUIStore((s) => s.selectEmail);
	const [expanded, setExpanded] = useState(false);
	const [mergeInput, setMergeInput] = useState("");
	const address = senderEmail.toLowerCase();

	const { data: contact } = useContact(mailboxId, address);
	const merge = useMergeContact();
	const unmerge = useUnmergeContact();

	if (!contact) return null;

	const display = parseAddress(contact.email, contact.name ?? senderName);
	const aliases = contact.addresses.filter((a) => a !== contact.email);
	const { stats } = contact;
	const others = contact.conversations.length;

	const error = (message: string) =>
		toastManager.add({ title: message, variant: "error" });

	const handleMerge = () => {
		const other = mergeInput.trim().toLowerCase();
		if (!mailboxId) return;
		if (!/^[^\s@<>]+@[^\s@<>]+$/.test(other)) {
			error("Enter a full email address, e.g. name@company.com");
			return;
		}
		merge.mutate(
			{ mailboxId, email: other, into: contact.email },
			{
				onSuccess: () => {
					setMergeInput("");
					toastManager.add({ title: `${other} merged into this contact` });
				},
				onError: () => error("Those addresses already belong to one contact"),
			},
		);
	};

	return (
		<div className="border-b border-kumo-line bg-kumo-tint/40 shrink-0">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex w-full items-center gap-3 px-4 py-2.5 text-left bg-transparent border-0 cursor-pointer md:px-6"
				aria-expanded={expanded}
			>
				<ContactAvatar label={display.label} email={contact.email} size={32} />
				<div className="min-w-0 flex-1">
					<div className="truncate text-sm font-medium text-kumo-default">
						{display.label}
						{aliases.length > 0 && (
							<span className="ml-2 text-xs font-normal text-kumo-subtle">
								+{aliases.length} address{aliases.length > 1 ? "es" : ""}
							</span>
						)}
					</div>
					<div className="truncate text-xs text-kumo-subtle">
						{contact.email} · {stats.conversation_count} conversation
						{stats.conversation_count !== 1 ? "s" : ""} ·{" "}
						{stats.total_messages} message
						{stats.total_messages !== 1 ? "s" : ""}
					</div>
				</div>
				{expanded ? (
					<CaretUpIcon size={14} className="text-kumo-subtle shrink-0" />
				) : (
					<CaretDownIcon size={14} className="text-kumo-subtle shrink-0" />
				)}
			</button>

			{expanded && (
				<div className="px-4 pb-3 md:px-6 space-y-3">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-kumo-subtle">
						{contact.domain && <span>Company: {contact.domain}</span>}
						{stats.first_date && (
							<span>First contact: {formatShortDate(stats.first_date)}</span>
						)}
						{stats.last_date && (
							<span>Last: {formatShortDate(stats.last_date)}</span>
						)}
						<Button
							variant="ghost"
							size="xs"
							icon={<MagnifyingGlassIcon size={12} />}
							onClick={() =>
								navigate(
									`/mailbox/${mailboxId}/search?q=${encodeURIComponent(`contact:${contact.email}`)}`,
								)
							}
						>
							View all mail
						</Button>
					</div>

					{aliases.length > 0 && (
						<div className="space-y-1">
							<div className="text-xs font-medium text-kumo-default">
								Also known as
							</div>
							<div className="flex flex-wrap gap-1.5">
								{aliases.map((alias) => (
									<span
										key={alias}
										className="inline-flex items-center gap-1 rounded-full bg-kumo-fill px-2 py-0.5 text-xs text-kumo-strong"
									>
										{alias}
										<button
											type="button"
											aria-label={`Unmerge ${alias}`}
											className="bg-transparent border-0 p-0 cursor-pointer text-kumo-subtle hover:text-kumo-destructive"
											onClick={() =>
												mailboxId &&
												unmerge.mutate(
													{ mailboxId, email: alias },
													{ onError: () => error("Failed to unmerge address") },
												)
											}
										>
											<XIcon size={11} />
										</button>
									</span>
								))}
							</div>
						</div>
					)}

					<div className="flex items-center gap-2">
						<input
							type="email"
							value={mergeInput}
							onChange={(e) => setMergeInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleMerge();
							}}
							placeholder="Same person? Add another address…"
							className="min-w-0 flex-1 rounded-md border border-kumo-line bg-kumo-base px-2.5 py-1.5 text-xs text-kumo-default"
						/>
						<Button
							variant="secondary"
							size="xs"
							icon={<LinkSimpleIcon size={12} />}
							onClick={handleMerge}
							disabled={!mergeInput.trim() || merge.isPending}
						>
							Merge
						</Button>
					</div>

					<div className="space-y-0.5">
						<div className="text-xs font-medium text-kumo-default">
							Conversations ({others})
						</div>
						<div className="max-h-48 overflow-y-auto -mx-2">
							{contact.conversations.map((c) => (
								<button
									key={c.id}
									type="button"
									onClick={() => selectEmail(c.id)}
									className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs bg-transparent border-0 cursor-pointer hover:bg-kumo-tint"
								>
									<span
										className={`truncate flex-1 ${c.unread_count > 0 ? "font-semibold text-kumo-default" : "text-kumo-strong"}`}
									>
										{c.subject || "(no subject)"}
									</span>
									{c.message_count > 1 && (
										<span className="shrink-0 rounded-full bg-kumo-fill px-1.5 text-kumo-subtle">
											{c.message_count}
										</span>
									)}
									<span className="shrink-0 text-kumo-subtle">
										{formatShortDate(c.date)}
									</span>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
