import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArrowDownUp, ArrowLeft, Ban, ChevronDown, ChevronUp, EyeOff, Flag, GripVertical, Hash, Loader2, Lock, MoreHorizontal, Pencil, Plus, SendHorizontal, Settings, SmilePlus, Trash2, UserX } from "lucide-react";
import { blockPerson, useBlocked } from "../../notes/PostMenu";
import Layout from "../../Layout";
import Markdown from "../../book/Markdown";
import Avatar from "../Avatar";
import GroupLogo from "../GroupLogo";
import { api } from "../lib";
import { ErrorNote, Loading } from "../ui";
import { consumer } from "../../../channels/consumer";
import { refreshNav, useMedia } from "../../shell/useShell";
import { showToast } from "../../../lib/toast";
import { ChannelForm, ChatSettings } from "./ChannelForm";
import MentionTextarea from "./MentionTextarea";
import ReportDialog from "./ReportDialog";

// Messages from the same person this close together run on under one name, like Slack
const RUN_GAP = 5 * 60 * 1000;
const TYPING_FOR = 4000;

// A group's chat (/groups/:slug/messages/:channelId, Api::GroupChatController): its channels on
// the left (a screen of their own on phones), the conversation on the right with the message box
// pinned to the bottom. New, changed and deleted messages arrive live (GroupChatChannel), with
// who's typing. @ in the box offers people and role handles; only mentions notify anyone. Anyone
// puts emoji on a message; admins set the order of the channels for everyone.
export default function ChatPage() {
  const { slug, channelId } = useParams();
  const navigate = useNavigate();
  const wide = useMedia("(min-width: 1024px)");
  const [chat, setChat] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [typing, setTyping] = useState({}); // { channelId: { userId: { name, until } } }
  const [form, setForm] = useState(null); // { channel? } while adding or changing a channel
  const [settings, setSettings] = useState(false);
  const listeners = useRef(new Set());
  const sub = useRef(null);
  const currentId = channelId ? Number(channelId) : null;
  const currentRef = useRef(currentId);
  currentRef.current = currentId;

  const load = useCallback(() => api(`/groups/${slug}/chat`).then((data) => { setChat(data); return data; }).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (chat) document.title = `Chat · ${chat.group.title} | RecoveryBot`; }, [chat?.group.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // On a wide screen there's always a channel open: #general to start
  const general = chat?.channels.find((c) => c.general);
  useEffect(() => {
    if (wide && chat && !currentId && general) navigate(`/${slug}/messages/${general.id}`, { replace: true });
  }, [wide, chat, currentId, general, slug, navigate]);

  // Live: every channel they're in, on one subscription. When the channels change (one added,
  // or who's in one), the list reloads and the subscription starts again.
  const meId = chat?.me.id;
  useEffect(() => {
    if (!meId) return undefined;
    const subscription = consumer.subscriptions.create({ channel: "GroupChatChannel", group: slug }, {
      connected() { listeners.current.forEach((fn) => fn({ type: "connected" })); },
      received(data) {
        if (data.type === "channels") { load().then(() => setVersion((v) => v + 1)); return; }
        if (data.type === "typing") {
          if (data.user.id === meId) return;
          setTyping((t) => ({ ...t, [data.channel_id]: { ...(t[data.channel_id] || {}), [data.user.id]: { name: data.user.name, until: Date.now() + TYPING_FOR } } }));
          return;
        }
        if (data.type === "created") {
          // Whoever posted stops typing; other channels get a count
          setTyping((t) => (t[data.channel_id]?.[data.user_id] ? { ...t, [data.channel_id]: { ...t[data.channel_id], [data.user_id]: { until: 0 } } } : t));
          if (data.user_id !== meId && data.channel_id !== currentRef.current) {
            setChat((c) => c && { ...c, channels: c.channels.map((ch) => (ch.id === data.channel_id ? { ...ch, unread: ch.unread + 1 } : ch)) });
          }
        }
        listeners.current.forEach((fn) => fn(data));
      },
    });
    sub.current = subscription;
    return () => { subscription.unsubscribe(); sub.current = null; };
  }, [slug, meId, version, load]);

  // Typing lines fade on their own
  useEffect(() => {
    const timer = setInterval(() => setTyping((t) => {
      const now = Date.now();
      const stale = Object.values(t).some((people) => Object.values(people).some((p) => p.until && p.until < now));
      if (!stale) return t;
      return Object.fromEntries(Object.entries(t).map(([id, people]) => [id, Object.fromEntries(Object.entries(people).filter(([, p]) => p.until > now))]));
    }), 1000);
    return () => clearInterval(timer);
  }, []);

  const listen = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);
  const sayTyping = useCallback((id) => sub.current?.perform("typing", { channel_id: id }), []);
  const markedRead = useCallback((id) => {
    setChat((c) => c && { ...c, channels: c.channels.map((ch) => (ch.id === id && ch.unread ? { ...ch, unread: 0 } : ch)) });
  }, []);

  if (error && !chat) {
    return <Layout isAuthenticated fill><div className="p-6"><ErrorNote error={error} /><Link to={`/${slug}`} className="mt-4 inline-block text-sm text-accent">Back to the group</Link></div></Layout>;
  }
  if (!chat) return <Layout isAuthenticated fill><div className="p-6"><Loading /></div></Layout>;

  const current = chat.channels.find((c) => c.id === currentId);
  const showList = wide || !currentId;
  const showConversation = wide || !!currentId;
  const typingIn = current ? Object.values(typing[current.id] || {}).filter((p) => p.until > Date.now()).map((p) => p.name) : [];

  return (
    <Layout isAuthenticated fill>
      <div className="wb chat-page flex h-[calc(100dvh-var(--nav-h)-var(--shell-bottom,0px))] min-h-[22rem] !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none lg:h-[calc(100dvh-var(--nav-h))]">
        {showList && (
          <ChannelList chat={chat} slug={slug} currentId={currentId} wide={wide}
            onAdd={() => setForm({})} onSettings={() => setSettings(true)} onArranged={setChat} />
        )}
        {showConversation && (current ? (
          <Conversation key={current.id} chat={chat} channel={current} slug={slug} wide={wide} listen={listen}
            sayTyping={sayTyping} typingNames={typingIn} onRead={markedRead} onEdit={() => setForm({ channel: current })} reload={load} />
        ) : (
          <section className="grid flex-1 place-items-center p-6 text-sm text-slate-500">
            {currentId ? <span>That channel isn't here, or you're not in it. <Link to={`/${slug}/messages`} className="text-accent">See your channels</Link></span> : <Loader2 className="size-5 animate-spin" />}
          </section>
        ))}
      </div>
      {form && (
        <ChannelForm chat={chat} slug={slug} channel={form.channel} onClose={() => setForm(null)}
          onSaved={(saved, removed) => {
            setForm(null);
            load().then(() => setVersion((v) => v + 1));
            if (removed) navigate(`/${slug}/messages`);
            else if (saved && !form.channel) navigate(`/${slug}/messages/${saved.id}`);
          }} />
      )}
      {settings && <ChatSettings chat={chat} slug={slug} onClose={() => setSettings(false)} onSaved={(data) => { setChat(data); setSettings(false); }} />}
    </Layout>
  );
}

function ChannelList({ chat, slug, currentId, wide, onAdd, onSettings, onArranged }) {
  const [showArchived, setShowArchived] = useState(false);
  const [arranging, setArranging] = useState(false);
  const open = chat.channels.filter((c) => !c.archived);
  const archived = chat.channels.filter((c) => c.archived);
  return (
    <aside aria-label="Channels" className={`flex min-h-0 flex-col border-neutral-200 dark:border-neutral-800 ${wide ? "w-72 shrink-0 border-r" : "w-full"}`}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <Link to={`/${slug}`} className="flex min-w-0 flex-1 items-center gap-2 !text-slate-900 dark:!text-white">
          <GroupLogo group={chat.group} className="size-8 text-[0.6rem]" />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">{chat.group.title}</span>
            <span className="block text-xs text-slate-500 dark:text-neutral-400">Chat</span>
          </span>
        </Link>
        {chat.can_manage && (
          <button type="button" onClick={onSettings} aria-label="Chat settings" title="Who can add channels"
            className="inline-grid size-9 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><Settings className="size-4" /></button>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-4 pb-1 pt-3">
        <h2 className="mr-auto text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">Channels</h2>
        {arranging ? (
          <button type="button" onClick={() => setArranging(false)} className="rounded-full !bg-accent px-3 py-1 text-xs font-semibold !text-white">Done</button>
        ) : (
          <>
            {chat.can_manage && open.length > 1 && (
              <button type="button" onClick={() => setArranging(true)} title="Change the order of the channels for everyone"
                className="inline-flex items-center gap-1 rounded-full !bg-transparent px-2 py-1 text-xs font-semibold text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800">
                <ArrowDownUp className="size-3.5" /> Rearrange
              </button>
            )}
            {chat.can_create && (
              <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-full !bg-transparent px-2 py-1 text-xs font-semibold text-accent hover:!bg-accent/10">
                <Plus className="size-3.5" /> Add
              </button>
            )}
          </>
        )}
      </div>
      {arranging ? (
        <ArrangeChannels channels={open} slug={slug} big={!wide} onArranged={onArranged} />
      ) : (
        <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-6">
          {open.map((c) => <ChannelLink key={c.id} channel={c} slug={slug} active={c.id === currentId} big={!wide} />)}
          {archived.length > 0 && (
            <>
              <button type="button" onClick={() => setShowArchived((s) => !s)} className="mt-3 flex w-full items-center gap-1.5 rounded-lg !bg-transparent px-3 py-1.5 text-xs font-medium text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800">
                <Archive className="size-3.5" /> {showArchived ? "Hide" : "Show"} {archived.length} archived
              </button>
              {showArchived && archived.map((c) => <ChannelLink key={c.id} channel={c} slug={slug} active={c.id === currentId} big={!wide} />)}
            </>
          )}
        </nav>
      )}
    </aside>
  );
}

// Admins put the channels in order for everyone: drag by the handle, or the arrows (one step at
// a time, for phones and keyboards). Each move saves.
function ArrangeChannels({ channels, slug, big, onArranged }) {
  const [list, setList] = useState(channels);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const save = async (next) => {
    const before = list;
    setList(next);
    setSaving(true);
    try {
      onArranged(await api(`/groups/${slug}/chat/order`, { method: "PATCH", body: { channel_ids: next.map((c) => c.id) } }));
    } catch (e) {
      setList(before);
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  const move = (from, to) => { if (to >= 0 && to < list.length) save(arrayMove(list, from, to)); };
  const end = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    move(list.findIndex((c) => c.id === active.id), list.findIndex((c) => c.id === over.id));
  };
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-6">
      <p className="px-3 pb-2 text-xs text-slate-500 dark:text-neutral-400">
        Drag or use the arrows. Everyone in the group sees this order. {saving && <Loader2 className="inline size-3 animate-spin" aria-label="Saving" />}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
        <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {list.map((c, i) => (
              <ArrangeRow key={c.id} channel={c} big={big} first={i === 0} last={i === list.length - 1}
                onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ArrangeRow({ channel: c, big, first, last, onUp, onDown }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const restricted = !c.access_roles.includes("members");
  const arrow = "inline-grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-200 disabled:opacity-25 dark:text-neutral-400 dark:hover:!bg-neutral-700";
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-xl bg-neutral-100 pl-1 pr-1 dark:bg-neutral-800 ${big ? "py-1.5 text-base" : "py-0.5 text-sm"} ${isDragging ? "relative z-10 shadow-lg ring-2 ring-accent" : ""}`}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Drag #${c.name}`}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:hover:text-white">
        <GripVertical className="size-4" />
      </button>
      {restricted ? <Lock className="size-3.5 shrink-0 text-slate-500" aria-label="Not everyone" /> : <Hash className="size-4 shrink-0 text-slate-500" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-neutral-200">{c.name}</span>
      <button type="button" onClick={onUp} disabled={first} aria-label={`Move #${c.name} up`} className={arrow}><ChevronUp className="size-4" /></button>
      <button type="button" onClick={onDown} disabled={last} aria-label={`Move #${c.name} down`} className={arrow}><ChevronDown className="size-4" /></button>
    </li>
  );
}

function ChannelLink({ channel: c, slug, active, big }) {
  const restricted = !c.access_roles.includes("members");
  return (
    <Link to={`/${slug}/messages/${c.id}`} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 ${big ? "py-3 text-base" : "py-1.5 text-sm"} ${active ? "!bg-accent/10 font-semibold !text-accent" : c.unread ? "font-bold !text-slate-900 hover:!bg-neutral-100 dark:!text-white dark:hover:!bg-neutral-800" : "!text-slate-600 hover:!bg-neutral-100 dark:!text-neutral-300 dark:hover:!bg-neutral-800"} ${c.archived ? "opacity-60" : ""}`}>
      {restricted ? <Lock className="size-3.5 shrink-0" aria-label="Not everyone" /> : <Hash className="size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      {c.unread > 0 && !active && <span className="rounded-full !bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold leading-none tabular-nums !text-white">{c.unread > 99 ? "99+" : c.unread}</span>}
    </Link>
  );
}

const dayKey = (iso) => new Date(iso).toDateString();
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }) });
}
const clockOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Conversation({ chat, channel, slug, wide, listen, sayTyping, typingNames, onRead, onEdit, reload }) {
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState(null);
  const [more, setMore] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [lastRead, setLastRead] = useState(0);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // the message whose actions show (tapped, on phones)
  const [editing, setEditing] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [focusId, setFocusId] = useState(() => Number(params.get("m")) || null);
  const scroller = useRef(null);
  const atBottom = useRef(true);
  const keepFrom = useRef(null); // scrollHeight before older messages went in on top
  const base = `/groups/${slug}/chat_channels/${channel.id}`;
  const where = useMemo(() => ({ group: slug, channel: channel.id }), [slug, channel.id]);

  const read = useCallback((list) => {
    const last = list?.[list.length - 1];
    if (!last || document.visibilityState !== "visible") return;
    api(`${base}/read`, { method: "POST", body: { message_id: last.id } }).then(() => { onRead(channel.id); refreshNav(); }).catch(() => {});
  }, [base, channel.id, onRead]);

  const loadLatest = useCallback(() => api(`${base}/messages`).then((data) => {
    setMessages((list) => {
      if (!list) return data.messages;
      // Coming back after being away: keep the older ones loaded, take the newest page as it is
      const first = data.messages[0]?.id ?? Infinity;
      return [...list.filter((m) => m.id < first), ...data.messages];
    });
    setMore((m) => m || data.more);
    setLastRead((r) => r || data.last_read);
    read(data.messages);
  }).catch((e) => setError(e.message)), [base, read]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  // Live: fetch a message that's new or changed, drop one that's gone
  useEffect(() => listen(async (data) => {
    if (data.type === "connected") { loadLatest(); return; }
    if (data.channel_id !== channel.id) return;
    if (data.type === "deleted") { setMessages((list) => list?.filter((m) => m.id !== data.id)); return; }
    if (data.type !== "created" && data.type !== "updated") return;
    try {
      const message = await api(`/groups/${slug}/chat_messages/${data.id}`);
      setMessages((list) => {
        if (!list) return list;
        if (list.some((m) => m.id === message.id)) return list.map((m) => (m.id === message.id ? message : m));
        return [...list, message].sort((a, b) => a.id - b.id);
      });
      if (data.type === "created") read([message]);
    } catch { /* deleted again before it came */ }
  }), [listen, channel.id, slug, loadLatest, read]);

  // Back to the tab: read what came in meanwhile
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && read(messages);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [messages, read]);

  // Stay at the bottom as messages come, unless they scrolled up to read; keep their place
  // when older ones go in above; open on a message from a notification
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !messages) return;
    if (keepFrom.current != null) { el.scrollTop += el.scrollHeight - keepFrom.current; keepFrom.current = null; return; }
    if (focusId) {
      const target = el.querySelector(`[data-message="${focusId}"]`);
      if (target) {
        target.scrollIntoView({ block: "center" });
        setTimeout(() => { setFocusId(null); setParams((p) => { p.delete("m"); return p; }, { replace: true }); }, 2500);
        return;
      }
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typingNames.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const older = async () => {
    if (!messages?.length || olderLoading) return;
    setOlderLoading(true);
    try {
      const data = await api(`${base}/messages?before=${messages[0].id}`);
      keepFrom.current = scroller.current?.scrollHeight ?? null;
      setMessages((list) => [...data.messages, ...list]);
      setMore(data.more);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setOlderLoading(false);
    }
  };

  const onScroll = () => {
    const el = scroller.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40 && more && !olderLoading) older();
  };

  const sent = (message) => {
    atBottom.current = true;
    setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
    setLastRead(message.id);
  };

  const remove = async (m) => {
    if (!window.confirm(m.mine ? "Delete your message?" : `Delete ${m.author.name}'s message?`)) return;
    try {
      await api(`/groups/${slug}/chat_messages/${m.id}`, { method: "DELETE" });
      setMessages((list) => list.filter((x) => x.id !== m.id));
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  // An emoji on or off: shown at once, then as the server has it (everyone else hears it live)
  const react = async (m, emoji) => {
    const had = m.reactions.find((r) => r.emoji === emoji);
    const taking = !!had?.mine;
    const reactions = taking
      ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false, names: r.names.filter((n) => n !== "You") } : r)).filter((r) => r.count > 0)
      : had ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: [...r.names, "You"] } : r))
        : [...m.reactions, { emoji, count: 1, mine: true, names: ["You"] }];
    const put = (msg) => setMessages((list) => list.map((x) => (x.id === msg.id ? msg : x)));
    put({ ...m, reactions });
    try {
      const path = `/groups/${slug}/chat_messages/${m.id}/reactions`;
      put(await api(taking ? `${path}?emoji=${encodeURIComponent(emoji)}` : path, taking ? { method: "DELETE" } : { method: "POST", body: { emoji } }));
    } catch (e) {
      put(m);
      showToast(e.message, { tone: "error" });
    }
  };

  // Blocking someone for yourself folds up their messages here
  useBlocked((id, blocked) => setMessages((list) => list?.map((m) => (m.author.id === id ? { ...m, blocked } : m))));

  const block = async (person) => {
    if (!window.confirm(`Block ${person.name} from ${chat.group.title}? They're taken out of the group and can't ask to join again until an admin unblocks them (in Members).`)) return;
    try {
      await api(`/groups/${slug}/blocks`, { method: "POST", body: { user_id: person.id } });
      showToast(`${person.name} is blocked from the group.`);
      reload();
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const restricted = !channel.access_roles.includes("members");
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`#${channel.name}`}>
      <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800 sm:px-5">
        {!wide && (
          <Link to={`/${slug}/messages`} aria-label="All channels" className="-ml-1 inline-grid size-9 shrink-0 place-items-center rounded-full !text-slate-600 hover:!bg-neutral-100 dark:!text-neutral-300 dark:hover:!bg-neutral-800">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1 truncate !text-lg font-bold text-slate-900 dark:text-white">
            {restricted ? <Lock className="size-4 shrink-0" aria-label="Not everyone" /> : <Hash className="size-4 shrink-0" aria-hidden="true" />}
            <span className="truncate">{channel.name}</span>
          </h1>
          {(channel.topic || restricted) && (
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
              {restricted && <>{whoIsIn(channel, chat)}{channel.topic ? " · " : ""}</>}{channel.topic}
            </p>
          )}
        </div>
        {channel.can_manage && (
          <button type="button" onClick={onEdit} aria-label="Change this channel" title="Change this channel"
            className="inline-grid size-9 shrink-0 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><Pencil className="size-4" /></button>
        )}
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-4">
        <ErrorNote error={error} />
        {!messages ? <Loading /> : (
          <>
            {more ? (
              <div className="py-2 text-center"><button type="button" onClick={older} className="rounded-full !bg-neutral-100 px-3 py-1 text-xs font-medium text-slate-600 dark:!bg-neutral-800 dark:text-neutral-300">{olderLoading ? "Loading…" : "Load earlier messages"}</button></div>
            ) : (
              <div className="px-3 pb-4 pt-6">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">Welcome to #{channel.name}</p>
                {channel.topic && <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">{channel.topic}</p>}
                <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
                  The start of this channel. Type @ to mention someone or a role like @hosts; they'll get a notification.
                </p>
              </div>
            )}
            {(() => {
              // The "New" line goes above the first message from someone else they hadn't read
              const firstNew = lastRead > 0 && messages.find((m) => m.id > lastRead && !m.mine)?.id;
              return messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
              const run = !newDay && prev.author.id === m.author.id && new Date(m.created_at) - new Date(prev.created_at) < RUN_GAP;
              const firstUnread = m.id === firstNew && i > 0;
              return (
                <React.Fragment key={m.id}>
                  {newDay && <DayDivider label={dayLabel(m.created_at)} />}
                  {firstUnread && <div className="my-2 flex items-center gap-2 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-rose-600"><span className="h-px flex-1 bg-rose-300" /> New</div>}
                  {editing === m.id ? (
                    <EditMessage message={m} slug={slug} where={where} onDone={(saved) => { setEditing(null); if (saved) setMessages((list) => list.map((x) => (x.id === saved.id ? saved : x))); }} />
                  ) : (
                    <ChatMessage message={m} run={run} me={chat.me.username} focused={m.id === focusId}
                      active={active === m.id} onTap={() => setActive((a) => (a === m.id ? null : m.id))}
                      canBlock={chat.can_manage && !m.mine} canReact={!channel.archived} onReact={(emoji) => react(m, emoji)}
                      onEdit={() => { setActive(null); setEditing(m.id); }} onDelete={() => remove(m)}
                      onReport={() => setReporting(m)} onBlock={() => block(m.author)} onBlockForMe={() => blockPerson(m.author)} />
                  )}
                </React.Fragment>
              );
              });
            })()}
          </>
        )}
      </div>

      <div className="h-5 px-5 text-xs text-slate-500 dark:text-neutral-400" aria-live="polite">
        {typingNames.length > 0 && <TypingLine names={typingNames} />}
      </div>
      {channel.archived ? (
        <p className="m-3 mt-0 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
          <Archive className="mr-1 inline size-4" /> This channel is archived. You can read it, but not post in it.
        </p>
      ) : (
        <Composer channel={channel} base={base} where={where} max={chat.message_max} onSent={sent} onTyping={() => sayTyping(channel.id)} />
      )}
      {reporting && <ReportDialog subject={{ type: "chat_message", id: reporting.id }} person={reporting.author} onClose={() => setReporting(null)} />}
    </section>
  );
}

function whoIsIn(channel, chat) {
  const roles = chat.roles.filter((r) => channel.access_roles.includes(r.key)).map((r) => r.label);
  const people = channel.access_user_ids.length;
  return ["Admins", ...roles, people ? `${people} ${people === 1 ? "person" : "people"}` : null].filter(Boolean).join(", ");
}

function DayDivider({ label }) {
  return (
    <div className="my-3 flex items-center gap-3 px-3" role="separator">
      <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700">{label}</span>
      <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}

function TypingLine({ names }) {
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.length} people`;
  return <span className="inline-flex items-center gap-1.5"><span className="chat-typing" aria-hidden="true"><i /><i /><i /></span> {who} {names.length === 1 ? "is" : "are"} typing…</span>;
}

function ChatMessage({ message: m, run, me, focused, active, onTap, canBlock, canReact, onReact, onEdit, onDelete, onReport, onBlock, onBlockForMe }) {
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const [shown, setShown] = useState(false);
  if (m.blocked && !shown) {
    return (
      <p data-message={m.id} className="mt-1 flex items-center gap-2 px-3 py-1 pl-[3.75rem] text-xs text-slate-400 dark:text-neutral-500">
        <EyeOff className="size-3.5" aria-hidden="true" /> A message from someone you blocked
        <button type="button" className="font-semibold !bg-transparent text-slate-500 hover:underline dark:text-neutral-400" onClick={() => setShown(true)}>Show</button>
      </p>
    );
  }
  const tap = (e) => { if (!e.target.closest("a, button")) onTap(); };
  const hl = m.mentions_me ? "bg-amber-50 dark:bg-amber-950/30 shadow-[inset_3px_0_0_theme(colors.amber.400)]" : "";
  return (
    <div data-message={m.id} onClick={tap}
      className={`group relative flex gap-3 rounded-xl px-3 ${run ? "py-0.5" : "mt-2 pb-0.5 pt-1.5"} hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${hl} ${focused ? "chat-focus" : ""} ${active ? "bg-neutral-50 dark:bg-neutral-800/50" : ""}`}>
      <div className="w-9 shrink-0">
        {run
          ? <time dateTime={m.created_at} className="hidden pt-0.5 text-[0.65rem] tabular-nums text-slate-400 group-hover:block">{clockOf(m.created_at).replace(/\s?[AP]M$/i, "")}</time>
          : <a href={`/people/${m.author.username}`} aria-label={m.author.name}><Avatar person={m.author} size={36} /></a>}
      </div>
      <div className="min-w-0 flex-1">
        {!run && (
          <p className="flex items-baseline gap-2 leading-tight">
            <a href={`/people/${m.author.username}`} className="truncate font-semibold !text-slate-900 hover:underline dark:!text-white">{m.author.name}</a>
            <time dateTime={m.created_at} className="shrink-0 text-xs text-slate-500 dark:text-neutral-400">{clockOf(m.created_at)}</time>
          </p>
        )}
        <div className="chat-body">
          <Markdown source={m.body} mentions={m.mentions} me={me} mine={m.mentions_me} className="text-[0.95rem] leading-relaxed text-slate-800 dark:text-neutral-100" />
          {m.edited && <span className="text-[0.7rem] text-slate-400"> (edited)</span>}
        </div>
        {m.reactions?.length > 0 && <Reactions reactions={m.reactions} canReact={canReact} onReact={onReact} onMore={() => setPicking(true)} />}
      </div>
      <div className={`absolute -top-3 right-2 z-[2] ${active || menu || picking ? "flex" : "hidden group-hover:flex"} items-center rounded-lg bg-white shadow-md ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700`}>
        {canReact && (
          <div className="relative">
            <IconButton label="Add a reaction" onClick={() => setPicking((o) => !o)} icon={SmilePlus} />
            {picking && <EmojiPicker onPick={(emoji) => { setPicking(false); onReact(emoji); }} onClose={() => setPicking(false)} />}
          </div>
        )}
        {m.mine && <IconButton label="Edit" onClick={onEdit} icon={Pencil} />}
        {m.can_remove && <IconButton label="Delete" onClick={onDelete} icon={Trash2} danger />}
        {!m.mine && (
          <div className="relative">
            <IconButton label="More" onClick={() => setMenu((o) => !o)} icon={MoreHorizontal} />
            {menu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700" onMouseLeave={() => setMenu(false)}>
                <MenuItem icon={Flag} onClick={() => { setMenu(false); onReport(); }}>Report to site admins</MenuItem>
                {!m.blocked && <MenuItem icon={UserX} danger onClick={() => { setMenu(false); onBlockForMe(); }}>Block {m.author.name.split(" ")[0]}</MenuItem>}
                {canBlock && <MenuItem icon={Ban} danger onClick={() => { setMenu(false); onBlock(); }}>Block from the group</MenuItem>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// The emoji on a message, each with how many: tap one to add yours or take it off. Who reacted
// shows on hover, or with a long press on a phone.
function Reactions({ reactions, canReact, onReact, onMore }) {
  const [showing, setShowing] = useState(null); // the emoji whose names show, after a long press
  const press = useRef({ timer: null, long: false });
  useEffect(() => {
    if (!showing) return undefined;
    const away = () => setShowing(null);
    const timer = setTimeout(away, 4000);
    document.addEventListener("pointerdown", away);
    return () => { clearTimeout(timer); document.removeEventListener("pointerdown", away); };
  }, [showing]);
  const down = (e, emoji) => {
    if (e.pointerType !== "touch") return;
    press.current.long = false;
    clearTimeout(press.current.timer);
    press.current.timer = setTimeout(() => { press.current.long = true; setShowing(emoji); navigator.vibrate?.(10); }, 450);
  };
  const cancel = () => clearTimeout(press.current.timer);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const who = `${listNames(r.names, r.count)} reacted with ${r.emoji}`;
        return (
          <span key={r.emoji} className="relative">
            <button type="button" title={who} aria-label={`${who}${r.mine ? ". Tap to take yours off" : ""}`} aria-pressed={r.mine}
              onPointerDown={(e) => down(e, r.emoji)} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => { if (press.current.long) { press.current.long = false; return; } if (canReact) onReact(r.emoji); }}
              className={`inline-flex h-7 select-none items-center gap-1 rounded-full px-2 text-sm tabular-nums ring-1 transition [-webkit-touch-callout:none] ${canReact ? "" : "cursor-default"} ${r.mine ? "!bg-accent/10 font-semibold !text-accent ring-accent/60" : "!bg-neutral-100 text-slate-600 ring-transparent hover:ring-neutral-300 dark:!bg-neutral-800 dark:text-neutral-300 dark:hover:ring-neutral-600"}`}>
              <span className="text-base leading-none">{r.emoji}</span> <span className="text-xs">{r.count}</span>
            </button>
            {showing === r.emoji && (
              <span role="tooltip" className="absolute bottom-full left-0 z-20 mb-1.5 w-max max-w-[16rem] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg dark:bg-neutral-700">
                {who}
              </span>
            )}
          </span>
        );
      })}
      {canReact && (
        <button type="button" onClick={onMore} aria-label="Add a reaction" title="Add a reaction"
          className="inline-grid h-7 w-8 place-items-center rounded-full !bg-neutral-100 text-slate-500 ring-1 ring-transparent hover:ring-neutral-300 dark:!bg-neutral-800 dark:text-neutral-400 dark:hover:ring-neutral-600">
          <SmilePlus className="size-4" />
        </button>
      )}
    </div>
  );
}

function listNames(names, count) {
  const shown = names.length;
  const others = count - shown;
  const all = others > 0 ? [...names, `${others} ${others === 1 ? "other" : "others"}`] : names;
  if (all.length <= 1) return all[0] || `${count} ${count === 1 ? "person" : "people"}`;
  return `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
}

// The emoji people reach for first, then more under them
const QUICK_EMOJI = ["👍", "❤️", "😂", "🙏", "🎉", "🤗"];
const MORE_EMOJI = [
  "😀", "😊", "🥰", "😍", "😎", "🤩", "🥳", "😅", "🤣", "😉", "🙂", "😌",
  "😮", "😢", "😭", "😬", "🤔", "🫡", "🙌", "👏", "💪", "👀", "✨", "🔥",
  "💯", "✅", "☕", "🌅", "🌈", "🕊️", "💙", "💜", "💚", "🧡", "⭐", "🎂",
  "🙃", "😴", "🫶", "🤝", "👋", "🤞", "🍪", "🍕",
];

// Opens below the message's buttons, or above them low on the screen, so it's never cut off
function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    const anchor = ref.current?.parentElement?.getBoundingClientRect();
    if (anchor) setUp(anchor.top > window.innerHeight / 2);
  }, []);
  useEffect(() => {
    const away = (e) => { if (!ref.current?.parentElement?.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [onClose]);
  const cell = "inline-grid size-9 place-items-center rounded-lg !bg-transparent text-xl hover:!bg-neutral-100 dark:hover:!bg-neutral-800";
  return (
    <div ref={ref} role="dialog" aria-label="Pick a reaction"
      className={`absolute right-0 z-20 w-[19.5rem] ${up ? "bottom-full mb-1" : "top-full mt-1"} max-w-[calc(100vw-2rem)] rounded-xl bg-white p-2 shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700`}>
      <div className="flex justify-between border-b border-neutral-200 pb-1.5 dark:border-neutral-700">
        {QUICK_EMOJI.map((e) => <button key={e} type="button" className={cell} onClick={() => onPick(e)} aria-label={`React with ${e}`}>{e}</button>)}
      </div>
      <div className="grid max-h-48 grid-cols-8 overflow-y-auto pt-1.5">
        {MORE_EMOJI.map((e) => <button key={e} type="button" className={cell} onClick={() => onPick(e)} aria-label={`React with ${e}`}>{e}</button>)}
      </div>
    </div>
  );
}

function IconButton({ label, onClick, icon: Icon, danger = false }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`inline-grid size-8 place-items-center rounded-lg !bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800 ${danger ? "text-rose-600" : "text-slate-600 dark:text-neutral-300"}`}>
      <Icon className="size-4" />
    </button>
  );
}

function MenuItem({ icon: Icon, onClick, danger = false, children }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 !bg-transparent px-3 py-2 text-left hover:!bg-neutral-100 dark:hover:!bg-neutral-800 ${danger ? "text-rose-600" : "text-slate-700 dark:text-neutral-200"}`}>
      <Icon className="size-4" /> {children}
    </button>
  );
}

// Enter sends on a computer (Shift+Enter for a new line); on a phone Enter is a new line and the
// button sends
const finePointer = () => window.matchMedia("(pointer: fine)").matches;

function Composer({ channel, base, where, max, onSent, onTyping }) {
  const key = `hb-chat-draft-${channel.id}`;
  const [body, setBody] = useState(() => { try { return sessionStorage.getItem(key) || ""; } catch { return ""; } });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const lastTyping = useRef(0);
  const ref = useRef(null);

  useEffect(() => { if (finePointer()) ref.current?.focus(); }, []);
  useEffect(() => { try { body ? sessionStorage.setItem(key, body) : sessionStorage.removeItem(key); } catch { /* private window */ } }, [key, body]);

  const change = (text) => {
    setBody(text);
    if (text.trim() && Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); onTyping(); }
  };

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await api(`${base}/messages`, { method: "POST", body: { body } });
      setBody("");
      lastTyping.current = 0;
      onSent(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  };

  return (
    <form className="chat-composer m-2 mt-0 rounded-2xl bg-neutral-100 p-1.5 ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-accent dark:bg-neutral-800 dark:ring-neutral-700 sm:m-3 sm:mt-0"
      onSubmit={(e) => { e.preventDefault(); send(); }}>
      {error && <p role="alert" className="px-2 pb-1 text-xs text-rose-600">{error}</p>}
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1">
          <MentionTextarea ref={ref} value={body} onChange={change} where={where} minRows={1} maxLength={max}
            placeholder={`Message #${channel.name}`} aria-label={`Message #${channel.name}`} enterKeyHint={finePointer() ? "send" : "enter"}
            className="chat-input"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && finePointer()) { e.preventDefault(); send(); }
            }} />
        </div>
        <button type="submit" disabled={sending || !body.trim()} aria-label="Send"
          className="mb-0.5 inline-grid size-10 shrink-0 place-items-center rounded-xl !bg-accent !text-white disabled:opacity-40">
          {sending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
        </button>
      </div>
    </form>
  );
}

function EditMessage({ message, slug, where, onDone }) {
  const [body, setBody] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      onDone(await api(`/groups/${slug}/chat_messages/${message.id}`, { method: "PATCH", body: { body } }));
    } catch (e) {
      showToast(e.message, { tone: "error" });
      setSaving(false);
    }
  };
  return (
    <div className="my-1 rounded-xl bg-neutral-100 p-2 ring-2 ring-accent dark:bg-neutral-800">
      <MentionTextarea value={body} onChange={setBody} where={where} minRows={1} autoFocus className="chat-input" aria-label="Change your message"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onDone(null); }
          if (e.key === "Enter" && !e.shiftKey && finePointer()) { e.preventDefault(); save(); }
        }} />
      <div className="mt-1 flex items-center justify-end gap-2 text-xs">
        <span className="mr-auto text-slate-500">Esc to cancel{finePointer() ? ", Enter to save" : ""}</span>
        <button type="button" onClick={() => onDone(null)} className="rounded-lg !bg-transparent px-2 py-1 font-medium text-slate-600 dark:text-neutral-300">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="rounded-lg !bg-accent px-3 py-1 font-semibold !text-white">{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
