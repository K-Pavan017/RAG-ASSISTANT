import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Bot, User, FileText, CheckCircle, Clock, AlertCircle, LogOut, Upload, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { source: string; content: string }[];
}

interface Document {
  id: string;
  filename: string;
  file_size: number;
  status: 'processing' | 'completed' | 'error';
  upload_date: string;
  error_message?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to AI Knowledge Assistant! Upload documents below and ask me anything about them.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
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

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents/');
      return res.data;
    },
    refetchInterval: 2000 // Refresh every 2 seconds to see processing status
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      console.log('Starting upload:', uploadFile.name, uploadFile.size);
      const formData = new FormData();
      formData.append('file', uploadFile);
      console.log('FormData created with file:', uploadFile.name);
      
      try {
        const res = await api.post('/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        console.log('Upload response:', res.data);
        return res.data;
      } catch (error: any) {
        console.error('Upload error details:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.config?.headers
        });
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Upload successful, invalidating documents query');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
      setUploadMessage('✓ Document uploaded successfully!');
      setTimeout(() => setUploadMessage(null), 4000);
    },
    onError: (err: any) => {
      console.error('Upload mutation error:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Upload failed';
      setUploadMessage(`❌ Error: ${errorMsg}`);
      setTimeout(() => setUploadMessage(null), 5000);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post('/chat/', { message: userMsg.content });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.answer,
        citations: res.data.citations
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
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
    console.log('Upload form submitted, file:', file);
    if (file) {
      console.log('File selected, size:', file.size, 'name:', file.name);
      uploadMutation.mutate(file);
    } else {
      console.warn('No file selected');
      setUploadMessage('⚠️ Please select a file first');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    console.log('File changed:', selectedFile?.name, 'size:', selectedFile?.size);
    setFile(selectedFile || null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    console.log('File dropped:', droppedFile?.name, 'type:', droppedFile?.type);
    if (droppedFile?.name.endsWith('.pdf')) {
      setFile(droppedFile);
      console.log('Valid PDF file set');
    } else {
      console.warn('Invalid file type:', droppedFile?.type);
      setUploadMessage('⚠️ Please drop a PDF file');
      setTimeout(() => setUploadMessage(null), 3000);
    }
  };

  const completedDocs = documents.filter((d: Document) => d.status === 'completed');
  const processingDocs = documents.filter((d: Document) => d.status === 'processing');
  const errorDocs = documents.filter((d: Document) => d.status === 'error');

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-100 p-2 rounded-lg">
            <Bot className="text-primary-600" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800">Knowledge Assistant</h1>
            <p className="text-xs text-slate-500">{completedDocs.length} documents ready</p>
          </div>
        </div>
        <button 
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <LogOut size={18} /> Logout
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={`rounded-2xl px-6 py-4 shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-100 text-slate-800'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed text-base break-words">{msg.content}</p>
                    
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sources:</p>
                        {msg.citations.map((cite, idx) => (
                          <div key={idx} className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100 hover:border-slate-200 transition-colors">
                            <p className="font-medium text-slate-700 flex items-center gap-2 mb-1">
                              <FileText size={14} className="text-slate-600" /> {cite.source}
                            </p>
                            <p className="text-slate-600 line-clamp-2 italic">"{cite.content}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-primary-600 shadow-sm">
                    <Bot size={20} />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your documents..."
                className="w-full rounded-full border border-slate-300 bg-white text-slate-800 pl-6 pr-14 py-4 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-sm transition-shadow"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar - Documents */}
        <div className="w-80 flex flex-col gap-4">
          {/* Upload Section */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Upload Documents</h3>
            <form onSubmit={handleUpload}>
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative"
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
                  <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-xs font-medium text-slate-700">
                    {file ? `✓ ${file.name}` : 'Drop PDF or click'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Max 50MB</p>
                </label>
              </div>
              {file && (
                <button 
                  type="submit" 
                  disabled={uploadMutation.isPending}
                  onClick={(e) => {
                    console.log('Upload button clicked, file:', file?.name);
                    handleUpload(e);
                  }}
                  className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-sm shadow-md"
                >
                  {uploadMutation.isPending ? '⏳ Uploading...' : '✓ Upload ' + (file?.name || '')}
                </button>
              )}
            </form>
            {uploadMessage && (
              <p className={`mt-2 text-xs ${uploadMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {uploadMessage}
              </p>
            )}
          </div>

          {/* Documents List */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Documents</h3>
            
            {processingDocs.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 font-medium mb-2">Processing...</p>
                {processingDocs.map((doc: Document) => (
                  <div key={doc.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg mb-2 text-xs">
                    <Clock size={12} className="text-amber-600 shrink-0" />
                    <span className="text-slate-700 truncate">{doc.filename}</span>
                  </div>
                ))}
              </div>
            )}

            {completedDocs.length > 0 ? (
              <div className="space-y-2">
                {completedDocs.map((doc: Document) => (
                  <div key={doc.id} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                    <CheckCircle size={12} className="text-green-600 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate" title={doc.filename}>{doc.filename}</p>
                      <p className="text-xs text-slate-500">{(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : !processingDocs.length && !errorDocs.length && (
              <p className="text-xs text-slate-500 text-center py-4">No documents yet</p>
            )}

            {errorDocs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 font-medium mb-2">Failed...</p>
                {errorDocs.map((doc: Document) => (
                  <div key={doc.id} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg mb-2">
                    <AlertCircle size={12} className="text-red-600 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate" title={doc.filename}>{doc.filename}</p>
                      {doc.error_message && <p className="text-xs text-red-600 mt-0.5">{doc.error_message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
