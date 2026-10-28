"use client";

import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  InboxIcon,
  KeyRoundIcon,
  MailOpenIcon,
  MessageSquareTextIcon,
  SendIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/admin/app-link";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import type { EmailSettingsView } from "@/lib/admin/email-settings";
import { createEntryRequest, emailRequest, RequestError } from "@/lib/admin/queries";

/** Resend's shared test sender: works before a domain is verified, but only to the account's own address. */
const TEST_SENDER = "onboarding@resend.dev";

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

type Explanation = { title: string; fix: string; link?: string; detail?: string };

/** The first thing the server objected to, in its own words. */
function messageOf(error: unknown): string {
  if (error instanceof RequestError) {
    const issues = error.detail.issues as { message?: string }[] | undefined;
    return issues?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "That did not work.";
}

export function EmailScreen({
  me,
  brand,
  settings,
  routes,
  rulesHref,
  canAddRule,
  inbox,
}: {
  me: string;
  brand: string;
  settings: EmailSettingsView;
  routes: { label: string; to: string[] }[];
  rulesHref: string | null;
  canAddRule: boolean;
  inbox: {
    messages: { href: string; total: number; fresh: number } | null;
    subscribers: { href: string; total: number } | null;
  };
}) {
  const router = useRouter();

  /* Sending */
  const [fromName, setFromName] = React.useState(settings.fromName);
  const [fromEmail, setFromEmail] = React.useState(settings.fromEmail);
  const [replyTo, setReplyTo] = React.useState(settings.replyTo);
  const [apiKey, setApiKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const badFrom = fromEmail.trim() !== "" && !EMAIL.test(fromEmail.trim());
  const badReply = replyTo.trim() !== "" && !EMAIL.test(replyTo.trim());
  const badKey = apiKey.trim() !== "" && !/^re_[A-Za-z0-9_-]{8,}$/.test(apiKey.trim());
  const dirty =
    fromName !== settings.fromName || fromEmail !== settings.fromEmail || replyTo !== settings.replyTo || apiKey.trim() !== "";

  const save = async (extra: { removeKey?: boolean } = {}) => {
    setSaving(true);
    try {
      await emailRequest({
        operation: "emailSave",
        fromName,
        fromEmail,
        replyTo,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...extra,
      });
      setApiKey("");
      toast.success(extra.removeKey ? "Saved key removed" : "Email settings saved", {
        description: "Send a test email to make sure it arrives.",
      });
      router.refresh();
      return true;
    } catch (error) {
      toast.error(messageOf(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* Test */
  const [testTo, setTestTo] = React.useState(me);
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: true; to: string } | { ok: false; explanation: Explanation } | null>(null);
  const sendTest = async () => {
    // Unsaved changes would make the test say nothing about what is saved.
    if (dirty && !(await save())) return;
    setTesting(true);
    setResult(null);
    try {
      await emailRequest({ operation: "emailTest", to: testTo.trim() });
      setResult({ ok: true, to: testTo.trim() });
    } catch (error) {
      const explanation =
        error instanceof RequestError && error.detail.explanation
          ? (error.detail.explanation as Explanation)
          : { title: messageOf(error), fix: "Check the settings and try again." };
      setResult({ ok: false, explanation });
    } finally {
      setTesting(false);
    }
  };

  /* Who gets them */
  const [adding, setAdding] = React.useState(false);
  const nobody = routes.every((route) => route.to.length === 0);
  const sendAllToMe = async () => {
    setAdding(true);
    try {
      await createEntryRequest({
        type: "email_notification",
        fields: [
          { key: "name", value: "Everything" },
          { key: "notification_type", value: "default" },
          { key: "recipients", value: JSON.stringify([me]) },
          { key: "enabled", value: "true" },
        ],
      });
      toast.success(`Emails will go to ${me}`, { description: "You can add more people or split them up later." });
      router.refresh();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setAdding(false);
    }
  };

  const missing = [
    !settings.key.source ? "a Resend API key" : null,
    !settings.effective.from ? "a sender address" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Where things stand, in one sentence, with the next step. */}
      {settings.ready ? (
        <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="font-medium">Email is set up</p>
            <p className="text-muted-foreground">
              Sent from <span className="text-foreground">{settings.effective.from}</span> through Resend.
              {nobody ? " Nobody on the team receives the website’s emails yet — see below." : " Send a test to be sure it arrives."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium">The website is not sending emails yet</p>
            <p className="text-muted-foreground">
              It still needs {missing.join(" and ")}. Fill {missing.length > 1 ? "them" : "it"} in below and press Save.
              Messages and sign-ups are kept under Inbox in the meantime, so nothing is lost.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRoundIcon className="size-4" /> Sending
            </CardTitle>
            <CardDescription>
              Emails go out through Resend.{" "}
              <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                resend.com
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!badFrom && !badReply && !badKey) void save();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email-key">Resend API key</Label>
                {settings.key.source ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="font-mono">
                      ••••{settings.key.hint}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {settings.key.source === "panel" ? "Saved here" : "Set on the server"}
                    </span>
                    {settings.key.source === "panel" ? (
                      <Button type="button" variant="ghost" size="xs" disabled={saving} onClick={() => void save({ removeKey: true })}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {settings.key.unreadable ? (
                  <p className="text-destructive text-xs">The saved key can no longer be read here. Paste it again and press Save.</p>
                ) : null}
                <Input
                  id="email-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={settings.key.source ? "Paste a new key to replace it" : "re_…"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  aria-invalid={badKey}
                  disabled={!settings.canStoreKey}
                  className="font-mono"
                />
                <p className={badKey ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                  {badKey
                    ? "That does not look like a Resend key — it starts with re_."
                    : settings.canStoreKey
                      ? "At Resend → API Keys. “Sending access” is enough. It is stored encrypted and never shown again."
                      : "A key can only be set on the server here. Ask your developer."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-from-name">Sender name</Label>
                <Input id="email-from-name" value={fromName} placeholder={brand} onChange={(event) => setFromName(event.target.value)} />
                <p className="text-muted-foreground text-xs">The name people see in their inbox.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-from">Sender address</Label>
                <Input
                  id="email-from"
                  type="email"
                  value={fromEmail}
                  placeholder={settings.effective.fromSource === "server" ? (settings.effective.from ?? "") : "hello@yourdomain.com"}
                  onChange={(event) => setFromEmail(event.target.value)}
                  aria-invalid={badFrom}
                />
                {badFrom ? (
                  <p className="text-destructive text-xs">That is not an email address.</p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Must be on a domain you have verified at{" "}
                    <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      Resend → Domains
                    </a>
                    . Not verified yet? Use the test sender for now — it can only send to your own Resend address.
                    {settings.effective.fromSource === "server" && !fromEmail ? " Empty uses the address set on the server." : ""}
                  </p>
                )}
                {fromEmail !== TEST_SENDER ? (
                  <Button type="button" variant="outline" size="xs" onClick={() => setFromEmail(TEST_SENDER)}>
                    Use the test sender
                  </Button>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-reply">Replies go to</Label>
                <Input
                  id="email-reply"
                  type="email"
                  value={replyTo}
                  placeholder="Optional"
                  onChange={(event) => setReplyTo(event.target.value)}
                  aria-invalid={badReply}
                />
                <p className={badReply ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                  {badReply
                    ? "That is not an email address."
                    : "When a customer presses Reply. Leave empty to reply to the sender address. Contact form emails always reply to the visitor."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving || !dirty || badFrom || badReply || badKey}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                {settings.updatedAt ? (
                  <span className="text-muted-foreground text-xs">
                    Last saved {new Date(settings.updatedAt).toLocaleString()}
                    {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}
                  </span>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SendIcon className="size-4" /> Send a test email
              </CardTitle>
              <CardDescription>The quickest way to know email works.{dirty ? " Your changes are saved first." : ""}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendTest();
                }}
              >
                <Label htmlFor="email-test" className="sr-only">
                  Send the test to
                </Label>
                <Input id="email-test" type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
                <Button type="submit" disabled={testing || saving || !EMAIL.test(testTo.trim()) || badFrom || badReply || badKey}>
                  {testing ? "Sending…" : "Send test"}
                </Button>
              </form>

              {result?.ok ? (
                <div role="status" className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p>
                    Sent. Look in the inbox of <strong>{result.to}</strong> — and the spam folder, the first time.
                  </p>
                </div>
              ) : null}
              {result && !result.ok ? (
                <div role="alert" className="border-destructive/30 bg-destructive/10 space-y-2 rounded-md border p-3 text-sm">
                  <p className="font-medium">{result.explanation.title}</p>
                  <p className="text-muted-foreground">{result.explanation.fix}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {result.explanation.link ? (
                      <Button asChild size="xs" variant="outline">
                        <a href={result.explanation.link} target="_blank" rel="noreferrer">
                          Open Resend <ExternalLinkIcon />
                        </a>
                      </Button>
                    ) : null}
                    {result.explanation.detail ? (
                      <span className="text-muted-foreground text-xs">Resend said: “{result.explanation.detail}”</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersRoundIcon className="size-4" /> Who gets the emails
              </CardTitle>
              <CardDescription>The team’s copy. Customers always get a confirmation of their own inquiry.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y rounded-md border text-sm">
                {routes.map((route) => (
                  <li key={route.label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                    <span className="font-medium">{route.label}</span>
                    <span className={route.to.length ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}>
                      {route.to.length ? route.to.join(", ") : "Nobody yet"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {nobody && canAddRule ? (
                  <Button type="button" size="sm" disabled={adding} onClick={() => void sendAllToMe()}>
                    {adding ? "Adding…" : `Send them all to ${me}`}
                  </Button>
                ) : null}
                {rulesHref ? (
                  <Button asChild size="sm" variant="outline">
                    <AppLink href={rulesHref} showPending={false}>
                      {nobody ? "Choose other people" : "Change who gets them"}
                    </AppLink>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {inbox.messages || inbox.subscribers ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <InboxIcon className="size-4" /> Kept in the panel
                </CardTitle>
                <CardDescription>Every message and sign-up is also saved here, even if an email does not arrive.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {inbox.messages ? (
                  <AppLink href={inbox.messages.href} className="hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors">
                    <MessageSquareTextIcon className="text-muted-foreground size-4 shrink-0" />
                    <span className="flex-1">Messages</span>
                    <span className="text-muted-foreground text-xs">
                      {inbox.messages.fresh ? `${inbox.messages.fresh} new` : inbox.messages.total}
                    </span>
                  </AppLink>
                ) : null}
                {inbox.subscribers ? (
                  <AppLink href={inbox.subscribers.href} className="hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors">
                    <MailOpenIcon className="text-muted-foreground size-4 shrink-0" />
                    <span className="flex-1">Subscribers</span>
                    <span className="text-muted-foreground text-xs">{inbox.subscribers.total}</span>
                  </AppLink>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
