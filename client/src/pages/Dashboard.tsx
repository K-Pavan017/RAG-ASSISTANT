import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle, Clock, AlertCircle, LogOut, MessageSquare } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents/');
      return res.data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      console.log('Starting upload:', uploadFile.name, uploadFile.size);
      const formData = new FormData();
      formData.append('file', uploadFile);
      
      try {
        const res = await api.post('/documents/upload', formData);
        console.log('Upload response:', res.data);
        return res.data;
      } catch (err: any) {
        console.error('Upload error details:', err.response?.data || err.message);
        throw err;
      }
    },
    onSuccess: () => {
      console.log('Upload mutation succeeded');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
      setUploadMessage('Upload successful');
    }
    ,
    onError: (err: any) => {
      console.error('Upload error', err);
      const errorMsg = err.response?.data?.detail || 'Upload failed';
      setUploadMessage(errorMsg);
    }
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleUpload called, file:', file);
    if (file) {
      console.log('Uploading file:', file.name, file.size);
      uploadMutation.mutate(file);
    } else {
      console.warn('No file selected');
      setUploadMessage('Please select a file');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    console.log('File selected:', selectedFile?.name, selectedFile?.size);
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
    if (droppedFile?.name.endsWith('.pdf')) {
      console.log('File dropped:', droppedFile.name);
      setFile(droppedFile);
    } else {
      setUploadMessage('Please drop a PDF file');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-primary-600">AI</span> Knowledge Assistant
          </h1>
          <div className="flex gap-4">
            <button onClick={() => navigate('/chat')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium">
              <MessageSquare size={18} /> Chat with Docs
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Upload Document</h2>
            <form onSubmit={handleUpload}>
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  accept=".pdf" 
                  id="file-input"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
                <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-3 pointer-events-none" />
                <p className="text-sm font-medium text-slate-700 pointer-events-none">
                  {file ? `✓ ${file.name}` : 'Click or drag PDF here'}
                </p>
                <p className="text-xs text-slate-500 mt-1 pointer-events-none">PDFs up to 50MB</p>
              </div>
              <button 
                type="submit" 
                disabled={!file || uploadMutation.isPending}
                className="mt-4 w-full bg-primary-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {uploadMutation.isPending ? 'Uploading...' : (file ? `Upload ${file.name}` : 'Select a file first')}
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Documents</h2>
            {uploadMessage && (
              <div className="mb-4 text-sm text-slate-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded">
                {uploadMessage}
              </div>
            )}
            
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (Array.isArray(documents) && documents.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <FileText className="h-12 w-12 mb-2 opacity-50" />
                <p>No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(documents) && documents.map((doc: any) => {
                  const filename = doc.filename || doc.name || 'Untitled.pdf';
                  const fileSizeBytes = doc.file_size ?? doc.size ?? 0;
                  const sizeMb = (fileSizeBytes / 1024 / 1024) || 0;
                  let uploadedDate = 'Unknown';
                  try {
                    uploadedDate = new Date(doc.upload_date || doc.created_at || Date.now()).toLocaleDateString();
                  } catch (e) {}
                  return (
                  <div key={doc._id || filename} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <FileText className="h-6 w-6 text-primary-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{filename}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          {sizeMb.toFixed(2)} MB • {uploadedDate}
                        </p>
                      </div>
                    </div>
                    <div>
                      {doc.status === 'completed' && <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full"><CheckCircle size={14} /> Ready</span>}
                      {doc.status === 'processing' && <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded-full"><Clock size={14} /> Processing</span>}
                      {doc.status === 'error' && <span className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full"><AlertCircle size={14} /> Error</span>}
                    </div>
                  </div>
                  )})}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
