import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Users, MessageSquare, PlusCircle, Settings, LogOut, 
  Search, Send, Image as ImageIcon, MoreVertical, ShieldAlert,
  UserCheck, UserPlus, Trash2, Megaphone, MessageCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const { user, logout, token } = useAuth();
  const { sendMessage, lastMessage } = useSocket();
  const [activeTab, setActiveTab] = useState<'home' | 'friends' | 'groups' | 'settings'>('home');
  const [selectedChat, setSelectedChat] = useState<{ id: number; name: string; type: 'private' | 'group' } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', content: '' });
  const [noticeComments, setNoticeComments] = useState<{ [key: number]: any[] }>({});
  const [newComment, setNewComment] = useState<{ [key: number]: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      fetchData();
      fetchNotices();
    }
  }, [token]);

  const fetchNotices = async () => {
    const res = await fetch('/api/notices', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setNotices(data);
    data.forEach((notice: any) => fetchComments(notice.id));
  };

  const fetchComments = async (noticeId: number) => {
    const res = await fetch(`/api/notices/${noticeId}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setNoticeComments(prev => ({ ...prev, [noticeId]: data }));
  };

  const createNotice = async () => {
    if (!newNotice.title || !newNotice.content) return;
    await fetch('/api/notices', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(newNotice)
    });
    setNewNotice({ title: '', content: '' });
    setShowCreateNotice(false);
    fetchNotices();
  };

  const addComment = async (noticeId: number) => {
    const content = newComment[noticeId];
    if (!content) return;
    await fetch(`/api/notices/${noticeId}/comments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ content })
    });
    setNewComment(prev => ({ ...prev, [noticeId]: '' }));
    fetchComments(noticeId);
  };

  useEffect(() => {
    if (lastMessage?.type === 'new_message') {
      const msg = lastMessage.message;
      if (
        (selectedChat?.type === 'private' && (msg.sender_id === selectedChat.id || msg.receiver_id === selectedChat.id)) ||
        (selectedChat?.type === 'group' && msg.group_id === selectedChat.id)
      ) {
        setMessages(prev => [...prev, msg]);
      }
    }
  }, [lastMessage, selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    const [suggestedRes, friendsRes, groupsRes] = await Promise.all([
      fetch('/api/users/suggested', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/users/friends', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } })
    ]);
    setSuggestedUsers(await suggestedRes.json());
    setFriends(await friendsRes.json());
    setGroups(await groupsRes.json());
  };

  const loadMessages = async (chat: any) => {
    const url = chat.type === 'private' ? `/api/messages/private/${chat.id}` : `/api/messages/group/${chat.id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    setMessages(await res.json());
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChat) return;

    sendMessage({
      type: 'message',
      messageType: selectedChat.type,
      receiverId: selectedChat.type === 'private' ? selectedChat.id : null,
      groupId: selectedChat.type === 'group' ? selectedChat.id : null,
      content: inputMessage
    });
    setInputMessage('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/messages/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.url) {
      sendMessage({
        type: 'message',
        messageType: selectedChat.type,
        receiverId: selectedChat.type === 'private' ? selectedChat.id : null,
        groupId: selectedChat.type === 'group' ? selectedChat.id : null,
        imageUrl: data.url
      });
    }
  };

  const followUser = async (id: number) => {
    await fetch(`/api/users/follow/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchData();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    await fetch('/api/groups', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ name: newGroupName, members: selectedMembers })
    });
    setShowCreateGroup(false);
    setNewGroupName('');
    setSelectedMembers([]);
    fetchData();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {/* Left Sidebar - Hidden on Mobile */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            ShineHub
          </div>

          <nav className="space-y-1">
            <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={20} />} label="Home" />
            <NavItem active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} icon={<Users size={20} />} label="My Friends" />
            <NavItem active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={<PlusCircle size={20} />} label="Groups" />
            {user?.role === 'admin' && (
              <NavItem active={false} onClick={() => window.location.href = '/admin'} icon={<ShieldAlert size={20} />} label="Admin Panel" />
            )}
            <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-gray-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {user?.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.class}-{user?.section}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium w-full"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white relative pb-16 md:pb-0">
        {activeTab === 'home' && (
          <>
            <header className="h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-6 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                {selectedChat && (
                  <button 
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-2 -ml-2 text-gray-400"
                  >
                    <Home size={20} />
                  </button>
                )}
                <h2 className="text-lg font-bold truncate max-w-[200px]">
                  {selectedChat ? selectedChat.name : 'ShineHub'}
                </h2>
              </div>
              {!selectedChat && user?.role === 'admin' && (
                <button 
                  onClick={() => setShowCreateNotice(true)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Megaphone size={16} /> Post Notice
                </button>
              )}
              {selectedChat && (
                <div className="flex items-center gap-2 md:gap-4">
                  <button className="text-gray-400 hover:text-gray-600 p-2"><Search size={20} /></button>
                  <button className="text-gray-400 hover:text-gray-600 p-2"><MoreVertical size={20} /></button>
                </div>
              )}
            </header>

            <div className={cn(
              "flex-1 overflow-y-auto p-4 md:p-6 space-y-6",
              selectedChat ? "block" : "hidden md:block"
            )}>
              {!selectedChat ? (
                <div className="space-y-8">
                  {/* Notice Board Section */}
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <Megaphone className="text-blue-600" size={24} />
                      <h3 className="text-2xl font-bold">Notice Board</h3>
                    </div>
                    
                    <div className="space-y-6">
                      {notices.length === 0 && (
                        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400">
                          No official notices yet.
                        </div>
                      )}
                      {notices.map(notice => (
                        <motion.div 
                          key={notice.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-blue-600 text-white rounded-3xl p-6 md:p-8 shadow-xl shadow-blue-100 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                          
                          <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="text-2xl md:text-3xl font-bold">{notice.title}</h4>
                              <span className="text-[10px] uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full font-bold">
                                Official
                              </span>
                            </div>
                            <p className="text-blue-50 text-lg leading-relaxed mb-6 whitespace-pre-wrap">
                              {notice.content}
                            </p>
                            <div className="flex items-center justify-between text-blue-100 text-xs border-t border-white/20 pt-4">
                              <p>Posted by {notice.admin_name}</p>
                              <p>{new Date(notice.created_at).toLocaleDateString()}</p>
                            </div>

                            {/* Comments Section */}
                            <div className="mt-6 bg-white/10 rounded-2xl p-4">
                              <h5 className="text-sm font-bold mb-3 flex items-center gap-2">
                                <MessageCircle size={16} /> Comments
                              </h5>
                              <div className="space-y-3 max-h-40 overflow-y-auto mb-4 pr-2 custom-scrollbar">
                                {(noticeComments[notice.id] || []).map((comment: any) => (
                                  <div key={comment.id} className="bg-white/10 rounded-xl p-2.5">
                                    <p className="text-[10px] font-bold text-blue-200">{comment.user_name}</p>
                                    <p className="text-sm">{comment.content}</p>
                                  </div>
                                ))}
                                {(!noticeComments[notice.id] || noticeComments[notice.id].length === 0) && (
                                  <p className="text-xs text-blue-200 italic">No comments yet.</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="Write a comment..."
                                  className="flex-1 bg-white/20 border-none rounded-lg px-3 py-1.5 text-sm placeholder:text-blue-200 outline-none focus:ring-1 focus:ring-white/50"
                                  value={newComment[notice.id] || ''}
                                  onChange={e => setNewComment(prev => ({ ...prev, [notice.id]: e.target.value }))}
                                  onKeyPress={e => e.key === 'Enter' && addComment(notice.id)}
                                />
                                <button 
                                  onClick={() => addComment(notice.id)}
                                  className="bg-white text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <Send size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="text-gray-400" size={20} />
                      <h3 className="text-lg font-bold text-gray-400">Recent Activity</h3>
                    </div>
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-4">
                      <MessageSquare size={48} className="opacity-20" />
                      <p>Select a classmate to start chatting</p>
                    </div>
                  </section>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.sender_id === user?.id ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] md:max-w-[70%] rounded-2xl p-3 shadow-sm",
                      msg.sender_id === user?.id ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none"
                    )}>
                      {selectedChat.type === 'group' && msg.sender_id !== user?.id && (
                        <p className="text-[10px] font-bold mb-1 opacity-70">{msg.sender_name}</p>
                      )}
                      {msg.content && <p className="text-sm leading-relaxed">{msg.content}</p>}
                      {msg.image_url && (
                        <img src={msg.image_url} alt="Shared" className="rounded-lg mt-1 max-w-full h-auto" />
                      )}
                      <p className={cn("text-[10px] mt-1 opacity-50", msg.sender_id === user?.id ? "text-right" : "text-left")}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat List on Mobile when no chat selected */}
            {!selectedChat && (
              <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Chats</h3>
                {friends.length === 0 && groups.length === 0 && (
                  <p className="text-center text-gray-400 py-8">No chats yet. Find friends to start!</p>
                )}
                {groups.map(group => (
                  <button 
                    key={`mob-g-${group.id}`}
                    onClick={() => {
                      setSelectedChat({ id: group.id, name: group.name, type: 'group' });
                      loadMessages({ id: group.id, type: 'group' });
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                      {group.name[0]}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">{group.name}</p>
                      <p className="text-xs text-gray-400">Group Chat</p>
                    </div>
                  </button>
                ))}
                {friends.map(friend => (
                  <button 
                    key={`mob-f-${friend.id}`}
                    onClick={() => {
                      setSelectedChat({ id: friend.id, name: friend.name, type: 'private' });
                      loadMessages({ id: friend.id, type: 'private' });
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      {friend.name[0]}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">{friend.name}</p>
                      <p className="text-xs text-gray-400">{friend.class}-{friend.section}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedChat && (
              <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-gray-100 flex items-center gap-2 md:gap-3 bg-white sticky bottom-16 md:bottom-0">
                <label className="cursor-pointer text-gray-400 hover:text-blue-600 transition-colors p-2">
                  <ImageIcon size={20} />
                  <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                </label>
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                />
                <button 
                  type="submit"
                  className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Send size={20} />
                </button>
              </form>
            )}
          </>
        )}

        {activeTab === 'friends' && (
          <div className="p-4 md:p-8 overflow-y-auto flex-1">
            <h2 className="text-xl md:text-2xl font-bold mb-6">My Friends</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {friends.map(friend => (
                <div key={friend.id} className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                    {friend.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm md:text-base">{friend.name}</p>
                    <p className="text-xs text-gray-400">{friend.class}-{friend.section}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedChat({ id: friend.id, name: friend.name, type: 'private' });
                      setActiveTab('home');
                      loadMessages({ id: friend.id, type: 'private' });
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              ))}
              {friends.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p>You haven't followed any classmates yet.</p>
                </div>
              )}
            </div>

            <div className="mt-12 md:hidden">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Students You May Know</h3>
              <div className="space-y-4">
                {suggestedUsers.map(sUser => (
                  <div key={`mob-s-${sUser.id}`} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      {sUser.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{sUser.name}</p>
                      <p className="text-xs text-gray-400">{sUser.class}-{sUser.section}</p>
                    </div>
                    <button 
                      onClick={() => followUser(sUser.id)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="p-4 md:p-8 overflow-y-auto flex-1">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold">Groups</h2>
              <button 
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-xl font-medium hover:bg-blue-700 transition-all text-sm md:text-base"
              >
                <PlusCircle size={18} /> Create
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {groups.map(group => (
                <div key={group.id} className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                    {group.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm md:text-base">{group.name}</p>
                    <p className="text-xs text-gray-400">Group Chat</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedChat({ id: group.id, name: group.name, type: 'group' });
                      setActiveTab('home');
                      loadMessages({ id: group.id, type: 'group' });
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  <PlusCircle size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No groups joined yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-4 md:p-8 max-w-2xl mx-auto w-full overflow-y-auto flex-1">
            <h2 className="text-xl md:text-2xl font-bold mb-8">Settings</h2>
            <div className="space-y-6">
              <div className="bg-white border border-gray-100 p-5 md:p-6 rounded-2xl shadow-sm">
                <h3 className="font-bold mb-4">Profile Information</h3>
                <div className="flex items-center gap-4 md:gap-6 mb-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-2xl md:text-3xl font-bold">
                    {user?.name[0]}
                  </div>
                  <button className="text-blue-600 font-medium hover:underline text-sm md:text-base">Change Photo</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold">Full Name</label>
                    <p className="font-medium text-sm md:text-base">{user?.name}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold">Class & Section</label>
                    <p className="font-medium text-sm md:text-base">{user?.class} - {user?.section}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-gray-100 p-5 md:p-6 rounded-2xl shadow-sm">
                <h3 className="font-bold mb-4 text-red-500">Danger Zone</h3>
                <div className="space-y-4">
                  <button 
                    onClick={logout}
                    className="w-full py-3 border border-red-100 text-red-500 rounded-xl font-medium hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut size={18} /> Log Out
                  </button>
                  <button className="w-full py-3 text-gray-400 text-sm font-medium hover:underline">Delete Account</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation for Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around h-16 px-2 z-20">
          <MobileNavItem active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setSelectedChat(null); }} icon={<Home size={22} />} label="Home" />
          <MobileNavItem active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} icon={<Users size={22} />} label="Friends" />
          <MobileNavItem active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={<PlusCircle size={22} />} label="Groups" />
          <MobileNavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={22} />} label="Settings" />
        </nav>
      </main>

      {/* Right Sidebar - Hidden on Mobile */}
      <aside className="hidden xl:block w-80 bg-gray-50 border-l border-gray-100 p-6 overflow-y-auto">
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Students You May Know</h3>
          <div className="space-y-4">
            {suggestedUsers.map(sUser => (
              <div key={sUser.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 font-bold">
                  {sUser.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{sUser.name}</p>
                  <p className="text-xs text-gray-400">{sUser.class}-{sUser.section}</p>
                </div>
                <button 
                  onClick={() => followUser(sUser.id)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <UserPlus size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Online Friends</h3>
          <div className="space-y-4">
            {friends.map(friend => (
              <div key={friend.id} className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 font-bold">
                    {friend.name[0]}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-50 rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{friend.name}</p>
                  <p className="text-xs text-gray-400">Active now</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">Create New Group</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Members</label>
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2">
                    {friends.map(friend => (
                      <label key={friend.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded text-blue-600"
                          checked={selectedMembers.includes(friend.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedMembers([...selectedMembers, friend.id]);
                            else setSelectedMembers(selectedMembers.filter(id => id !== friend.id));
                          }}
                        />
                        <span className="text-sm font-medium">{friend.name}</span>
                      </label>
                    ))}
                    {friends.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No friends to add yet.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowCreateGroup(false)}
                  className="flex-1 py-2 text-gray-400 font-medium hover:bg-gray-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={createGroup}
                  className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Notice Modal */}
      <AnimatePresence>
        {showCreateNotice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Megaphone className="text-blue-600" size={20} /> Post Official Notice
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notice Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Sports Day Announcement"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={newNotice.title}
                    onChange={e => setNewNotice({ ...newNotice, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    rows={4}
                    placeholder="Write the notice details here..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    value={newNotice.content}
                    onChange={e => setNewNotice({ ...newNotice, content: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowCreateNotice(false)}
                  className="flex-1 py-2 text-gray-400 font-medium hover:bg-gray-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={createNotice}
                  className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Post Notice
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
        active 
          ? "bg-blue-50 text-blue-600" 
          : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center flex-1 h-full transition-all gap-1",
        active ? "text-blue-600" : "text-gray-400"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

