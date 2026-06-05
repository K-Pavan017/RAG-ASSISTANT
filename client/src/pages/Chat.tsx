import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, User, FileText, CheckCircle, Clock, AlertCircle, LogOut, Upload, Sparkles, Plus, MessageSquare, Trash2, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { source: string; content: string }[];
  timestamp?: string;
}

interface Document {
  id: string;
  filename: string;
  file_size: number;
  status: 'processing' | 'completed' | 'error';
  upload_date: string;
  error_message?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/chat/sessions');
      return res.data as ChatSession[];
    }
  });

  // Set initial session
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  // Fetch chat history for current session
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chatHistory', currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return [];
      const res = await api.get(`/chat/${currentSessionId}`);
      return res.data;
    },
    enabled: !!currentSessionId
  });

  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      setMessages(chatHistory);
    } else {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: 'Welcome to AI Knowledge Assistant! Upload documents below and ask me anything about them.'
      }]);
    }
  }, [chatHistory, currentSessionId]);

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents/');
      return res.data;
    },
    refetchInterval: 2000
  });

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/chat/sessions');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setCurrentSessionId(data.id);
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/chat/sessions/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
      setUploadMessage('✓ Document uploaded successfully!');
      setTimeout(() => setUploadMessage(null), 4000);
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.detail || err.message || 'Upload failed';
      setUploadMessage(`❌ Error: ${errorMsg}`);
      setTimeout(() => setUploadMessage(null), 5000);
    }
  });

  const handleNewChat = () => {
    createSessionMutation.mutate();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      const session = await createSessionMutation.mutateAsync();
      targetSessionId = session.id;
      setCurrentSessionId(session.id);
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post('/chat/', { message: userMsg.content, session_id: targetSessionId });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.answer,
        citations: res.data.citations
      };
      setMessages(prev => [...prev, assistantMsg]);
      queryClient.invalidateQueries({ queryKey: ['chatHistory', targetSessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      uploadMutation.mutate(file);
    } else {
      setUploadMessage('⚠️ Please select a file first');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile?.name.endsWith('.pdf')) {
      setFile(droppedFile);
    } else {
      setUploadMessage('⚠️ Please drop a PDF file');
      setTimeout(() => setUploadMessage(null), 3000);
    }
  };

  const completedDocs = documents.filter((d: Document) => d.status === 'completed');
  const processingDocs = documents.filter((d: Document) => d.status === 'processing');
  const errorDocs = documents.filter((d: Document) => d.status === 'error');

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/30 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/70 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-xl shadow-md shadow-indigo-200">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg tracking-tight">Knowledge Assistant</h1>
            <p className="text-xs font-medium text-slate-500">{completedDocs.length} documents ready</p>
          </div>
        </div>
        <button 
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
        >
          <LogOut size={16} /> Logout
        </button>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 gap-6 p-6 max-w-full mx-auto w-full h-[calc(100vh-73px)]">
        
        {/* Left Sidebar - Chat Sessions */}
        <div className="w-64 flex flex-col gap-4 bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-200/60 overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-200/60">
            <button 
              onClick={handleNewChat}
              disabled={createSessionMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-md hover:shadow-indigo-200 disabled:opacity-70"
            >
              <Plus size={18} /> New Chat
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3 px-2">Recent Chats</p>
            <div className="space-y-1">
              {sessions.map((session: ChatSession) => (
                <div 
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentSessionId === session.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm text-indigo-700' : 'hover:bg-slate-50 border border-transparent text-slate-700'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className={currentSessionId === session.id ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-500'} />
                    <span className="text-sm font-medium truncate">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Delete this chat?")) {
                        deleteSessionMutation.mutate(session.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400 font-medium">
                  No chats yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-full text-slate-400">Loading history...</div>
            ) : (
              messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-indigo-600'}`}>
                      {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                    </div>
                    <div className={`rounded-2xl px-5 py-4 shadow-sm relative group ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
                      <p className="whitespace-pre-wrap leading-relaxed text-[15px] break-words">{msg.content}</p>
                      
                      {msg.citations && msg.citations.length > 0 && (
                        <details className="mt-4 pt-4 border-t border-slate-100/20 group">
                          <summary className={`cursor-pointer select-none text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                            Sources
                            <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="space-y-2 mt-2">
                            {Array.from(new Set(msg.citations.map(c => c.source))).map((sourceName, idx) => (
                              <div key={idx} className={`rounded-xl p-3 text-sm transition-all ${msg.role === 'user' ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-md'}`}>
                                <p className={`font-medium flex items-center gap-2 ${msg.role === 'user' ? 'text-indigo-100' : 'text-indigo-700'}`}>
                                  <FileText size={14} className={msg.role === 'user' ? 'text-indigo-200' : 'text-indigo-400'} /> {sourceName}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Bot size={20} />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-6 py-5 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white/50 border-t border-slate-100 backdrop-blur-md">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your documents..."
                className="w-full rounded-2xl border border-slate-200 bg-white/80 text-slate-800 pl-6 pr-16 py-4 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 shadow-inner transition-all placeholder:text-slate-400"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-3 p-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar - Documents */}
        <div className="w-80 flex flex-col gap-6 shrink-0">
          {/* Upload Section */}
          <div className="bg-white/70 backdrop-blur-sm p-5 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-200/60">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload size={16} className="text-indigo-500" /> Upload Documents
            </h3>
            <form onSubmit={handleUpload}>
              <div 
                className="border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center bg-indigo-50/50 hover:bg-indigo-50 transition-colors cursor-pointer relative group"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {file ? <span className="text-indigo-600 truncate block px-2">✓ {file.name}</span> : 'Drop PDF or click'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Max 50MB</p>
                </label>
              </div>
              {file && (
                <button 
                  type="submit" 
                  disabled={uploadMutation.isPending}
                  onClick={(e) => {
                    handleUpload(e);
                  }}
                  className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md shadow-indigo-200 flex justify-center items-center gap-2 text-sm"
                >
                  {uploadMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                  ) : (
                    <>✓ Upload File</>
                  )}
                </button>
              )}
            </form>
            {uploadMessage && (
              <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${uploadMessage.includes('Error') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                {uploadMessage.includes('Error') ? <AlertCircle size={14}/> : <CheckCircle size={14}/>}
                {uploadMessage}
              </div>
            )}
          </div>

          {/* Documents List */}
          <div className="bg-white/70 backdrop-blur-sm p-5 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-200/60 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-indigo-500" /> Document Library
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 custom-scrollbar">
              {processingDocs.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Processing</p>
                  <div className="space-y-2">
                    {processingDocs.map((doc: Document) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-amber-50/80 border border-amber-100 rounded-xl text-sm">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Clock size={14} className="text-amber-600 animate-pulse" />
                        </div>
                        <span className="text-amber-800 font-medium truncate">{doc.filename}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completedDocs.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Available</p>
                  <div className="space-y-2">
                    {completedDocs.map((doc: Document) => (
                      <div key={doc.id} className="group flex items-start justify-between gap-2 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all">
                        <div className="flex items-start gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                            <CheckCircle size={14} className="text-emerald-600 group-hover:text-indigo-600 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate" title={doc.filename}>{doc.filename}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (window.confirm("Delete this document?")) {
                              deleteDocumentMutation.mutate(doc.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !processingDocs.length && !errorDocs.length && (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <FileText size={20} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No documents yet</p>
                  <p className="text-xs text-slate-400">Upload a PDF to get started</p>
                </div>
              )}

              {errorDocs.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-4">Failed</p>
                  <div className="space-y-2">
                    {errorDocs.map((doc: Document) => (
                      <div key={doc.id} className="group flex items-start justify-between gap-2 p-3 bg-red-50/80 border border-red-100 rounded-xl">
                        <div className="flex items-start gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <AlertCircle size={14} className="text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-red-800 truncate" title={doc.filename}>{doc.filename}</p>
                            {doc.error_message && <p className="text-xs text-red-600/80 mt-1">{doc.error_message}</p>}
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (window.confirm("Delete this document?")) {
                              deleteDocumentMutation.mutate(doc.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Add some global styles for custom scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
