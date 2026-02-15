import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Send,
  Image as ImageIcon,
  CheckCheck,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react';
import { User } from '../types';
import {
  ApiMessage,
  ApiPresence,
  ApiThread,
  fetchMessagesRaw,
  fetchPresence,
  fetchUser,
  pingPresence,
  resolveAssetUrl,
  uploadMessageImage,
} from '../api';

interface MessagesProps {
  onBack: () => void;
  currentUser: User | null;
  activeThreadId: string | null;
  onThreadOpen: (threadId: string) => void;
  pendingThread?: ApiThread | null;
  onFetchThreads: () => Promise<ApiThread[]>;
  onFetchMessages: (threadId: string) => Promise<ApiMessage[]>;
  onSendMessage: (threadId: string, content: string) => Promise<void>;
  onUnreadUpdate: () => Promise<void>;
}

const formatChatTime = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatListTime = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const formatPresenceTime = (iso?: string | null): string => {
  if (!iso) return 'Offline';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Offline';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return 'Last seen just now';
  if (diffMs < 60 * 60 * 1000) return `Last seen ${Math.floor(diffMs / 60000)} min ago`;
  if (diffMs < 24 * 60 * 60 * 1000) {
    return `Last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `Last seen ${date.toLocaleDateString()}`;
};

const Messages: React.FC<MessagesProps> = ({
  onBack,
  currentUser,
  activeThreadId,
  onThreadOpen,
  pendingThread,
  onFetchThreads,
  onFetchMessages,
  onSendMessage,
  onUnreadUpdate,
}) => {
  const [threads, setThreads] = useState<ApiThread[]>([]);
  const [messages, setMessages] = useState<Record<string, ApiMessage[]>>({});
  const [activeChat, setActiveChat] = useState<string | null>(activeThreadId);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [threadMeta, setThreadMeta] = useState<Record<string, { unread: number; last?: ApiMessage }>>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [otherPresence, setOtherPresence] = useState<ApiPresence | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveChat(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (!currentUser) return;
    setLoadingThreads(true);
    onFetchThreads()
      .then(setThreads)
      .finally(() => setLoadingThreads(false));
  }, [currentUser, onFetchThreads]);

  useEffect(() => {
    if (!currentUser) return;
    const ping = async () => {
      try {
        await pingPresence(currentUser.id);
      } catch {
        // Ignore presence failures so messaging still works.
      }
    };
    ping();
    const interval = setInterval(ping, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || threads.length === 0) return;
    const loadMeta = async () => {
      const entries = await Promise.all(
        threads.map(async (thread) => {
          try {
            const msgs = await fetchMessagesRaw(thread.id);
            const unread = msgs.filter(
              (msg) => msg.receiver_id === currentUser.id && !msg.is_read
            ).length;
            const last = msgs[msgs.length - 1];
            return [thread.id, { unread, last }] as const;
          } catch {
            return [thread.id, { unread: 0 }] as const;
          }
        })
      );
      setThreadMeta((prev) => {
        const next = { ...prev };
        entries.forEach(([id, meta]) => {
          next[id] = meta;
        });
        return next;
      });
    };
    loadMeta();
  }, [currentUser, threads]);

  useEffect(() => {
    if (!pendingThread) return;
    setThreads((prev) => {
      if (prev.some((thread) => thread.id === pendingThread.id)) return prev;
      return [pendingThread, ...prev];
    });
    setActiveChat(pendingThread.id);
  }, [pendingThread]);

  useEffect(() => {
    if (!currentUser || threads.length === 0) return;
    const ids = new Set<string>();
    threads.forEach((thread) => {
      const otherId = currentUser.id === thread.buyer_id ? thread.seller_id : thread.buyer_id;
      if (otherId && !userAvatars[otherId]) {
        ids.add(otherId);
      }
    });
    if (ids.size === 0) return;
    Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          const user = await fetchUser(id);
          return [id, user.avatar || ''] as const;
        } catch {
          return [id, ''] as const;
        }
      })
    ).then((entries) => {
      setUserAvatars((prev) => {
        const next = { ...prev };
        entries.forEach(([id, avatar]) => {
          if (avatar) next[id] = avatar;
        });
        return next;
      });
    });
  }, [currentUser, threads, userAvatars]);

  useEffect(() => {
    if (!activeChat) return;
    onFetchMessages(activeChat).then((data) => {
      setMessages((prev) => ({ ...prev, [activeChat]: data }));
      onUnreadUpdate();
      setThreadMeta((prev) => ({
        ...prev,
        [activeChat]: { unread: 0, last: data[data.length - 1] },
      }));
    });
  }, [activeChat, onFetchMessages, onUnreadUpdate]);

  const activeThread = threads.find((thread) => thread.id === activeChat) || pendingThread || null;
  const otherUserId = useMemo(() => {
    if (!activeThread || !currentUser) return null;
    return currentUser.id === activeThread.buyer_id ? activeThread.seller_id : activeThread.buyer_id;
  }, [activeThread, currentUser]);

  useEffect(() => {
    if (!otherUserId) {
      setOtherPresence(null);
      return;
    }
    let cancelled = false;
    const loadPresence = async () => {
      try {
        const data = await fetchPresence(otherUserId);
        if (!cancelled) setOtherPresence(data);
      } catch {
        if (!cancelled) setOtherPresence(null);
      }
    };
    loadPresence();
    const interval = setInterval(loadPresence, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [otherUserId]);

  const activeMessages = useMemo(() => {
    if (!activeChat) return [];
    return messages[activeChat] || [];
  }, [activeChat, messages]);

  const filteredThreads = threads.filter((thread) => {
    const otherName = currentUser?.id === thread.buyer_id ? thread.seller_name : thread.buyer_name;
    return (otherName || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getThreadTitle = (thread: ApiThread) => {
    if (!currentUser) return thread.buyer_name || thread.seller_name || 'Conversation';
    return currentUser.id === thread.buyer_id ? thread.seller_name : thread.buyer_name;
  };

  const getThreadAvatar = (thread: ApiThread) => {
    if (!currentUser) return 'https://picsum.photos/id/64/100/100';
    const otherId = currentUser.id === thread.buyer_id ? thread.seller_id : thread.buyer_id;
    return (otherId && userAvatars[otherId]) || 'https://picsum.photos/id/64/100/100';
  };

  const getImageUrlFromContent = (content?: string) => {
    if (!content) return null;
    const trimmed = content.trim();
    if (!trimmed.startsWith('image:')) return null;
    const url = trimmed.slice('image:'.length).trim();
    return url ? resolveAssetUrl(url) : null;
  };

  const getMessagePreview = (content?: string) => {
    if (!content) return '';
    if (content.trim().startsWith('image:')) return 'Image';
    return content;
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat || !currentUser) return;
    const content = inputText.trim();
    setInputText('');
    await onSendMessage(activeChat, content);
    const updated = await onFetchMessages(activeChat);
    setMessages((prev) => ({ ...prev, [activeChat]: updated }));
    await onUnreadUpdate();
    setThreadMeta((prev) => ({
      ...prev,
      [activeChat]: { unread: 0, last: updated[updated.length - 1] },
    }));
  };

  const handleImagePick = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !currentUser) return;
    setIsUploadingImage(true);
    try {
      const { url } = await uploadMessageImage(file);
      await onSendMessage(activeChat, `image:${url}`);
      const updated = await onFetchMessages(activeChat);
      setMessages((prev) => ({ ...prev, [activeChat]: updated }));
      await onUnreadUpdate();
      setThreadMeta((prev) => ({
        ...prev,
        [activeChat]: { unread: 0, last: updated[updated.length - 1] },
      }));
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex justify-center md:items-center md:min-h-[calc(100vh-140px)]">
      <div className="w-full h-[calc(100vh-120px)] md:h-auto md:w-[960px] md:aspect-[3/2]">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden h-full flex flex-col md:flex-row ring-1 ring-black/5">
        {/* Sidebar / Conversation List */}
        <div className={`w-full md:w-1/3 border-r border-gray-100 flex flex-col bg-gray-50/30 ${activeChat !== null ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-5 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={onBack}
                className="p-1.5 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="Go Back"
              >
                <ArrowLeft size={22} />
              </button>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Messages</h2>
            </div>
            <div className="relative group">
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 text-sm pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#57068c]/20 focus:bg-white transition-all"
              />
              <Search size={18} className="absolute left-3 top-3 text-gray-400 group-focus-within:text-[#57068c] transition-colors" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
            {loadingThreads ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading conversations...</div>
            ) : filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => {
                const title = getThreadTitle(thread) || 'Conversation';
                const lastMsg = threadMeta[thread.id]?.last?.content || 'Start a conversation';
                const lastTime = threadMeta[thread.id]?.last?.created_at || thread.created_at;
                const unread = threadMeta[thread.id]?.unread || 0;
                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setActiveChat(thread.id);
                      onThreadOpen(thread.id);
                    }}
                    className={`p-3 rounded-2xl flex gap-3 cursor-pointer transition-all duration-200 border border-transparent ${
                      activeChat === thread.id ? 'bg-white shadow-sm border-gray-100 scale-[1.02]' : 'hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img src={getThreadAvatar(thread)} alt={title} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <span className={`font-bold text-sm truncate ${activeChat === thread.id ? 'text-gray-900' : 'text-gray-700'}`}>{title}</span>
                        <span className="text-[10px] font-medium text-gray-400 shrink-0">{formatListTime(lastTime)}</span>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-xs truncate flex-1 ${unread > 0 ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{getMessagePreview(lastMsg)}</p>
                        {unread > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold h-5 min-w-[1.25rem] px-1.5 flex items-center justify-center rounded-full shadow-sm shadow-red-200 shrink-0">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">No conversations found</div>
            )}
          </div>
        </div>

        {/* Chat Area - Right Side */}
        <div className={`md:w-2/3 flex-1 flex flex-col bg-white relative ${activeChat === null ? 'hidden md:flex' : 'flex'}`}>
          {activeChat !== null && activeThread ? (
            <>
              {/* Chat Header */}
              <div className="h-20 border-b border-gray-100 px-6 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10 sticky top-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                  </button>
                  <div className="relative">
                    <img src={getThreadAvatar(activeThread)} alt="User" className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{getThreadTitle(activeThread)}</h3>
                    {otherPresence?.online ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Online now
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                        {formatPresenceTime(otherPresence?.last_seen)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-400" />
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 scroll-smooth no-scrollbar">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Today</span>
                </div>
                {activeMessages.map((msg) => {
                  const sender = currentUser?.id === msg.sender_id ? 'me' : 'them';
                  const imageUrl = getImageUrlFromContent(msg.content);
                  return (
                    <div key={msg.id} className={`flex ${sender === 'me' ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`flex flex-col max-w-[75%] md:max-w-[60%] ${sender === 'me' ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`shadow-sm relative ${
                            imageUrl
                              ? `p-1 ${
                                  sender === 'me'
                                    ? 'bg-[#57068c]/10 rounded-2xl rounded-tr-none'
                                    : 'bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-none'
                                }`
                              : `px-5 py-3.5 ${
                                  sender === 'me'
                                    ? 'bg-[#57068c] text-white rounded-2xl rounded-tr-none'
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-none'
                                }`
                          }`}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt="Shared" className="max-h-64 rounded-xl object-cover" />
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 px-1">
                          <span className="text-[10px] font-medium text-gray-400">{formatChatTime(msg.created_at)}</span>
                          {sender === 'me' && <CheckCheck size={12} className={msg.is_read ? 'text-[#57068c]' : 'text-gray-300'} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex items-end gap-3 w-full pt-1.5">
                  <div className="flex items-center gap-1 pb-1">
                    <button
                      onClick={handleImagePick}
                      disabled={!activeChat || isUploadingImage}
                      className="p-2.5 text-gray-400 hover:text-[#57068c] hover:bg-purple-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Upload image"
                    >
                      <ImageIcon size={24} />
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>

                  <div className="flex-1 bg-gray-100 hover:bg-gray-50 focus-within:bg-white border-2 border-transparent focus-within:border-[#57068c] focus-within:ring-4 focus-within:ring-[#57068c]/15 rounded-3xl px-5 py-3 transition-all duration-200">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-800 placeholder-gray-400 resize-none leading-relaxed outline-none"
                      style={{ minHeight: '24px', maxHeight: '120px' }}
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className={`p-3.5 rounded-full transition-all duration-200 shadow-sm flex items-center justify-center pb-3.5 ${
                      inputText.trim()
                        ? 'bg-[#57068c] text-white hover:bg-[#450470] shadow-purple-200 hover:scale-105 active:scale-95'
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Send size={20} className={inputText.trim() ? 'ml-0.5' : ''} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white p-8 text-center animate-fade-in">
              <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mb-6 text-[#57068c]">
                <MessageCircle size={48} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Messages</h3>
              <p className="text-gray-500 max-w-sm leading-relaxed">
                Select a conversation from the list to view your chat history or start a new message.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default Messages;
