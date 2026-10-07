import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

/**
 * Conversations — WhatsApp-style inbox.
 * Left: chat list. Middle: full message thread. Right: customer & lead details.
 * Refreshes automatically every few seconds.
 */

const C = {
  navy: '#1a1a2e',
  green: '#128c4a',
  greenSoft: '#dcf5e3',
  agent: '#e3ecff',
  alert: '#fff4d6',
  line: '#e6e7ef',
  muted: '#6b6b80',
  bg: '#f5f6fa',
  chatBg: '#efeae2',
  red: '#c62828',
};

const LIST_REFRESH_MS = 10000;
const THREAD_REFRESH_MS = 5000;

const FLOW_LABELS = {
  welcome: 'Main menu',
  idle: 'Main menu',
  buy_furniture: 'Buy furniture',
  setup_office: 'Setup office',
  bulk_corporate: 'Bulk / corporate',
  find_product: 'Find a product',
  store_visit: 'Store visit',
  talk_to_sales: 'Talk to sales',
};

function formatTime(d) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayLabel(d) {
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name, number) {
  if (name) return name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (number || '').slice(-2);
}

/** WhatsApp *bold* and _italic_ → simple formatting. */
function WaText({ text }) {
  const parts = String(text || '').split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return parts.map((p, i) => {
    if (/^\*[^*]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
    if (/^_[^_]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

export default function Conversations() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(''); // '' | 'HUMAN' | 'BOT'
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);

  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Chat list ────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const data = await api.getConversations({ limit: 50, owner: filter, search });
      setList(data.conversations || []);
      setTotal(data.total || 0);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(loadList, search ? 300 : 0); // debounce search typing
    return () => clearTimeout(t);
  }, [loadList, search]);

  useEffect(() => {
    const t = setInterval(loadList, LIST_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadList]);

  // ── Message thread ───────────────────────────────────────────────────────
  const loadThread = useCallback(async (id, { silent } = {}) => {
    if (!id) return;
    if (!silent) setThreadLoading(true);
    try {
      const data = await api.getConversationMessages(id);
      setThread(data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    lastCountRef.current = 0;
    setThread(null);
    loadThread(selectedId);
    const t = setInterval(() => loadThread(selectedId, { silent: true }), THREAD_REFRESH_MS);
    return () => clearInterval(t);
  }, [selectedId, loadThread]);

  // Scroll to newest message when the chat opens or new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    const count = thread?.messages?.length || 0;
    if (!el || !count) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (lastCountRef.current === 0 || (count > lastCountRef.current && nearBottom)) {
      el.scrollTop = el.scrollHeight;
    }
    lastCountRef.current = count;
  }, [thread]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const conversation = thread?.conversation;
  const isHuman = conversation?.owner === 'HUMAN';

  async function takeOver() {
    setBusy(true);
    try {
      await api.takeoverConversation(selectedId, 'admin');
      await Promise.all([loadThread(selectedId, { silent: true }), loadList()]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function handBack() {
    setBusy(true);
    try {
      await api.releaseConversation(selectedId);
      await Promise.all([loadThread(selectedId, { silent: true }), loadList()]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !conversation) return;
    setBusy(true);
    try {
      await api.sendMessage(conversation.whatsappNumber, text);
      setDraft('');
      await loadThread(selectedId, { silent: true });
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (e) {
      setError(`Message not sent: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // WhatsApp only allows free-text replies within 24h of the customer's last message
  const lastInbound = [...(thread?.messages || [])].reverse().find((m) => m.direction === 'inbound');
  const windowClosed = lastInbound && Date.now() - new Date(lastInbound.createdAt).getTime() > 24 * 3600 * 1000;

  const selectedFromList = list.find((c) => c._id === selectedId);
  const name = thread?.contact?.name || selectedFromList?.customerName;
  const showList = !isNarrow || !selectedId;
  const showThread = !isNarrow || selectedId;

  return (
    <div style={{ display: 'flex', height: '100%', background: C.bg }}>
      <style>{`
        .conv-item { all: unset; box-sizing: border-box; display: flex; gap: 12px; width: 100%; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid ${C.line}; }
        .conv-item:hover { background: #f7f8fb; }
        .conv-item[aria-current="true"] { background: #eef7f1; }
        .conv-item:focus-visible, .chip:focus-visible, .act:focus-visible { outline: 2px solid ${C.green}; outline-offset: -2px; }
        .chip { border: 1px solid ${C.line}; background: #fff; border-radius: 999px; padding: 5px 12px; font-size: 13px; cursor: pointer; color: ${C.navy}; }
        .chip[aria-pressed="true"] { background: ${C.navy}; color: #fff; border-color: ${C.navy}; }
        .act { border: 1px solid ${C.line}; background: #fff; border-radius: 8px; padding: 7px 14px; font-size: 13px; cursor: pointer; color: ${C.navy}; font-weight: 600; }
        .act.primary { background: ${C.green}; color: #fff; border-color: ${C.green}; }
        .act:disabled { opacity: .55; cursor: default; }
      `}</style>

      {/* ── Chat list ─────────────────────────────────────────────────── */}
      {showList && (
        <section aria-label="Chats" style={{
          width: isNarrow ? '100%' : 340, flexShrink: 0, background: '#fff',
          borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: 20, color: C.navy }}>Chats</h1>
              <span style={{ fontSize: 12, color: C.muted }}>{total} total</span>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              aria-label="Search chats"
              style={{
                width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '9px 12px',
                border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, background: C.bg,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="chip" aria-pressed={filter === ''} onClick={() => setFilter('')}>All</button>
              <button className="chip" aria-pressed={filter === 'HUMAN'} onClick={() => setFilter('HUMAN')}>Waiting for sales</button>
              <button className="chip" aria-pressed={filter === 'BOT'} onClick={() => setFilter('BOT')}>With bot</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {listLoading && <div style={{ padding: 20, color: C.muted, fontSize: 14 }}>Loading chats…</div>}
            {!listLoading && list.length === 0 && (
              <div style={{ padding: 24, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
                {search || filter
                  ? 'No chats match this search or filter.'
                  : 'No chats yet. When a customer messages your WhatsApp number, the chat appears here.'}
              </div>
            )}
            {list.map((c) => (
              <button
                key={c._id}
                className="conv-item"
                aria-current={c._id === selectedId}
                onClick={() => setSelectedId(c._id)}
              >
                <Avatar name={c.customerName} number={c.whatsappNumber} human={c.owner === 'HUMAN'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.customerName || `+${c.whatsappNumber}`}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{formatTime(c.lastMessage?.at || c.lastMessageAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 13, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessage
                        ? `${c.lastMessage.direction === 'outbound' ? 'You: ' : ''}${(c.lastMessage.text || '').replace(/[*_]/g, '').split('\n')[0]}`
                        : FLOW_LABELS[c.currentFlow] || ''}
                    </span>
                    {c.owner === 'HUMAN' && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: C.red, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>
                        Sales
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Thread ────────────────────────────────────────────────────── */}
      {showThread && (
        <section aria-label="Messages" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selectedId ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: C.muted, fontSize: 15, padding: 24, textAlign: 'center' }}>
              Select a chat to read the conversation.
            </div>
          ) : (
            <>
              {/* Header */}
              <header style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                background: '#fff', borderBottom: `1px solid ${C.line}`,
              }}>
                {isNarrow && (
                  <button className="act" onClick={() => setSelectedId(null)} aria-label="Back to chats">←</button>
                )}
                <Avatar name={name} number={conversation?.whatsappNumber || selectedFromList?.whatsappNumber} human={isHuman} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>
                    {name || `+${conversation?.whatsappNumber || selectedFromList?.whatsappNumber || ''}`}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    +{conversation?.whatsappNumber || selectedFromList?.whatsappNumber}
                    {conversation && ` · ${isHuman ? 'With sales team' : `Bot: ${FLOW_LABELS[conversation.currentFlow] || conversation.currentFlow}`}`}
                  </div>
                </div>
                {conversation && (isHuman ? (
                  <button className="act" onClick={handBack} disabled={busy}>Hand back to bot</button>
                ) : (
                  <button className="act primary" onClick={takeOver} disabled={busy}>Take over chat</button>
                ))}
                {!isNarrow && (
                  <button className="act" onClick={() => setShowDetails((v) => !v)} aria-pressed={showDetails}>
                    {showDetails ? 'Hide details' : 'Details'}
                  </button>
                )}
              </header>

              {error && (
                <div role="alert" style={{ background: '#fdecea', color: C.red, fontSize: 13, padding: '8px 18px' }}>{error}</div>
              )}

              {/* Messages */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: C.chatBg, padding: '16px 6%' }}>
                {threadLoading && <div style={{ textAlign: 'center', color: C.muted, fontSize: 14 }}>Loading messages…</div>}
                {thread && thread.messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: C.muted, fontSize: 14 }}>No messages saved for this chat yet.</div>
                )}
                {thread?.messages.map((m, i) => {
                  const prev = thread.messages[i - 1];
                  const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                  return (
                    <div key={m._id}>
                      {newDay && (
                        <div style={{ textAlign: 'center', margin: '14px 0' }}>
                          <span style={{ background: '#fff', color: C.muted, fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <Bubble m={m} />
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <footer style={{ background: '#fff', borderTop: `1px solid ${C.line}`, padding: '12px 18px' }}>
                {!conversation ? null : !isHuman ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: C.muted }}>
                    <span style={{ flex: 1 }}>The bot is replying to this customer. Take over the chat to reply yourself.</span>
                    <button className="act primary" onClick={takeOver} disabled={busy}>Take over chat</button>
                  </div>
                ) : (
                  <>
                    {windowClosed && (
                      <div style={{ fontSize: 12, color: '#8a5a00', background: C.alert, borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                        The customer's last message was over 24 hours ago. WhatsApp may block this reply until they message you again — calling them is safer.
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                        }}
                        placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)"
                        aria-label="Reply message"
                        rows={2}
                        style={{
                          flex: 1, resize: 'none', padding: '10px 12px', borderRadius: 8,
                          border: `1px solid ${C.line}`, fontSize: 14, fontFamily: 'inherit',
                        }}
                      />
                      <button className="act primary" onClick={send} disabled={busy || !draft.trim()}>
                        {busy ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </>
                )}
              </footer>
            </>
          )}
        </section>
      )}

      {/* ── Details ───────────────────────────────────────────────────── */}
      {selectedId && thread && showDetails && !isNarrow && (
        <aside aria-label="Customer details" style={{
          width: 290, flexShrink: 0, background: '#fff', borderLeft: `1px solid ${C.line}`,
          overflowY: 'auto', padding: 18,
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, color: C.navy }}>Customer</h2>
          <Detail label="Name" value={thread.contact?.name} />
          <Detail label="WhatsApp" value={`+${thread.conversation.whatsappNumber}`} />
          <Detail label="Company" value={thread.contact?.companyName} />
          <Detail label="First contact" value={thread.contact?.createdAt && new Date(thread.contact.createdAt).toLocaleDateString('en-IN')} />
          {thread.contact?.consent?.optOutStatus && <Detail label="Marketing" value="Opted out (STOP)" />}

          <h2 style={{ margin: '22px 0 12px', fontSize: 15, color: C.navy }}>
            Enquiries {thread.leads?.length ? `(${thread.leads.length})` : ''}
          </h2>
          {!thread.leads?.length && <div style={{ fontSize: 13, color: C.muted }}>No enquiries recorded yet.</div>}
          {thread.leads?.map((l) => (
            <div key={l.leadId} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <ScoreBadge score={l.leadScore} />
                <span style={{ fontSize: 11, color: C.muted }}>{formatTime(l.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: C.navy, fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>
                {l.requirement || l.category || l.leadType.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
                {l.companyName && <div>Company: {l.companyName}</div>}
                {l.quantity && <div>Quantity: {l.quantity}</div>}
                {l.budget && <div>Budget: {l.budget}</div>}
                {l.location && <div>Location: {l.location}</div>}
                {l.timeline && <div>Timeline: {l.timeline}</div>}
                {l.quoteRequested && <div style={{ color: C.green, fontWeight: 600 }}>Quote requested</div>}
                <div style={{ marginTop: 4, fontSize: 11 }}>{l.leadId}</div>
              </div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

function Avatar({ name, number, human }) {
  return (
    <div aria-hidden="true" style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      background: human ? '#fde7e7' : '#e7efe9', color: human ? C.red : C.green, fontWeight: 700, fontSize: 14,
    }}>
      {initials(name, number)}
    </div>
  );
}

function Bubble({ m }) {
  const out = m.direction === 'outbound';
  const who = !out ? null : m.sentBy === 'agent' ? 'You' : m.sentBy === 'alert' ? 'Sales alert' : 'Bot';
  const bg = !out ? '#fff' : m.sentBy === 'agent' ? C.agent : m.sentBy === 'alert' ? C.alert : C.greenSoft;

  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      <div style={{
        maxWidth: '72%', background: bg, borderRadius: 10, padding: '7px 10px 5px',
        boxShadow: '0 1px 0.5px rgba(0,0,0,.08)', fontSize: 14, color: '#1f1f2a', lineHeight: 1.45,
      }}>
        {who && <div style={{ fontSize: 11, fontWeight: 700, color: m.sentBy === 'agent' ? '#2c4fb5' : C.green, marginBottom: 2 }}>{who}</div>}
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><WaText text={m.displayText} /></div>
        {m.options?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {m.options.map((o, i) => (
              <span key={i} style={{ fontSize: 12, border: `1px solid ${C.green}`, color: C.green, borderRadius: 999, padding: '1px 8px', background: '#fff' }}>
                {o}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 2 }}>
          {m.status === 'failed' && <span style={{ color: C.red, fontWeight: 600 }}>Not delivered · </span>}
          {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const styles = {
    HOT: { bg: '#fde7e7', fg: C.red },
    WARM: { bg: '#fff1d6', fg: '#a35b00' },
    COLD: { bg: '#e8eaf2', fg: C.muted },
  }[score || 'COLD'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: styles.bg, color: styles.fg }}>
      {score || 'COLD'}
    </span>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.navy, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}