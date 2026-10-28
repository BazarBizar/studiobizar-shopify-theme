/**
 * A Behold feed id, from the bare id or its `https://feeds.behold.so/<id>` address —
 * null for anything else. The fetch address is then built from the id alone, so a
 * value typed into the panel can never point the server at another host.
 */
export function beholdFeedId(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const id = /^https:\/\/feeds\.behold\.so\/([A-Za-z0-9]+)\/?$/.exec(text)?.[1] ?? text;
  return /^[A-Za-z0-9]{6,64}$/.test(id) ? id : null;
}
