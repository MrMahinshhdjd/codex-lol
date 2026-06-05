/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Settings, Bot, User, Sparkles, Zap, Shield, 
  Copy, Check, Trash2, Folder, FolderOpen, FileCode,
  ChevronDown, ChevronRight, HelpCircle, RefreshCw,
  Download, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { generateChat, generateChatStream } from './services/geminiService';
import { Message, ModelMode, FileAction } from './types';

// Custom Code Block Component with Copy feature
const CodeBlock = (props: any) => {
  const { node, className, children, ...rest } = props;
  const [copied, setCopied] = useState(false);
  
  // react-markdown v10 doesn't pass 'inline' prop.
  // Fenced code blocks usually have a className like 'language-lua'.
  const isInline = !className;
  const code = String(children).replace(/\n$/, '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isInline) {
    return <code className="bg-gray-100 rounded px-1 text-[11px] font-mono text-indigo-500" {...rest}>{children}</code>;
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-[#1e1e1e]">
      <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-gray-400 font-bold ml-2 uppercase tracking-widest font-mono">CODE</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-bold text-gray-300 transition-all border border-white/10 active:scale-95"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span className="text-green-400">COPIED</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>COPY CODE</span>
            </>
          )}
        </button>
      </div>
      <pre className="!m-0 !rounded-none bg-[#1e1e1e] p-4 overflow-x-auto text-[13px] leading-relaxed text-gray-200 font-mono scrollbar-thin">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </div>
  );
};

// Folder Interface definition
interface FolderData {
  name: string;
  relativePath: string;
}

// Custom Collapsible Directory Explorer Component
const FolderExplorer = ({ 
  loaded, 
  folders,
  onSelectFile
}: { 
  loaded: string[]; 
  folders: FolderData[]; 
  onSelectFile?: (file: string) => void;
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'Root': true
  });

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Group files by relative folder paths
  const fileGroups: Record<string, string[]> = { 'Root': [] };
  const allFolders = new Set<string>();

  // Extract all possible folders from loaded files and explicit folders
  folders.forEach(fold => allFolders.add(fold.relativePath));
  loaded.forEach(filePath => {
    const parts = filePath.split('/');
    if (parts.length > 1) {
      // Add all ancestor directories
      for (let i = 1; i < parts.length; i++) {
        allFolders.add(parts.slice(0, i).join('/'));
      }
    }
  });

  // Unique sorted list of folders
  const sortedFolders = Array.from(allFolders).sort();

  // Initialize fileGroups
  sortedFolders.forEach(folderPath => {
    fileGroups[folderPath] = [];
  });

  loaded.forEach(filePath => {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash === -1) {
      fileGroups['Root'].push(filePath);
    } else {
      const folderPath = filePath.substring(0, lastSlash);
      fileGroups[folderPath]?.push(filePath);
    }
  });

  return (
    <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin text-xs text-gray-600 pr-1 select-none">
      {/* Root level files */}
      {fileGroups['Root'] && fileGroups['Root'].length > 0 && (
        <div className="border border-gray-100 rounded-xl p-2 bg-gray-50/50">
          <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold uppercase mb-1.5 px-1">
            <FolderOpen size={11} className="text-gray-400" />
            <span>Root Scripts</span>
          </div>
          <div className="space-y-1">
            {fileGroups['Root'].map(file => (
              <button 
                key={file} 
                onClick={() => onSelectFile?.(file)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all font-mono text-[10px] text-gray-600 cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-indigo-100"
              >
                <FileCode size={11} className="text-indigo-400 flex-shrink-0" />
                <span className="truncate" title={file}>{file}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subfolder trees */}
      {sortedFolders.map(folderPath => {
        const isExpanded = !!expandedFolders[folderPath];
        const folderFiles = fileGroups[folderPath] || [];
        
        return (
          <div key={folderPath} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-3xs hover:shadow-2xs transition-all">
            {/* Folder Header */}
            <button
              onClick={() => toggleFolder(folderPath)}
              className="w-full flex items-center justify-between p-2 hover:bg-gray-50/45 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 mt-0.5">
                  {isExpanded ? (
                    <FolderOpen size={13} className="text-amber-500" />
                  ) : (
                    <Folder size={13} className="text-amber-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold font-mono text-[10.5px] text-gray-700 block truncate leading-tight">{folderPath}/</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
                <span className="bg-gray-100/80 text-gray-400 font-bold rounded-md px-1 py-0.5 text-[8px] scale-95 font-mono">
                  {folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}
                </span>
                {isExpanded ? (
                  <ChevronDown size={11} className="text-gray-400" />
                ) : (
                  <ChevronRight size={11} className="text-gray-400" />
                )}
              </div>
            </button>

            {/* Expander list */}
            {isExpanded && (
              <div className="border-t border-gray-50 bg-gray-50/20 p-2 space-y-1">
                {folderFiles.length === 0 ? (
                  <div className="p-2 text-center text-[9px] text-gray-400 italic">Folder context empty</div>
                ) : (
                  folderFiles.map(file => {
                    const parts = file.split('/');
                    const fileNameOnly = parts[parts.length - 1];
                    return (
                      <button 
                        key={file} 
                        onClick={() => onSelectFile?.(file)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white shadow-3xs border border-gray-100 hover:border-amber-300 hover:bg-amber-50/10 transition-all font-mono text-[9.5px] text-gray-600 cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-amber-200"
                      >
                        <FileCode size={11} className="text-amber-500/70 flex-shrink-0" />
                        <span className="truncate" title={file}>{fileNameOnly}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {loaded.length === 0 && (
        <div className="p-4 text-center text-gray-400 italic text-[10px]">
          Workspace file index is currently empty.
        </div>
      )}
    </div>
  );
};

// Parse <file_create path="...">content</file_create> and <file_delete path="..." />
const parseFileActions = (content: string): FileAction[] => {
  const actions: FileAction[] = [];
  
  // Tag regex for create file: <file_create path="...">content</file_create>
  const createRegex = /<file_create\s+path="([^"]+)">([\s\S]*?)<\/file_create>/g;
  let match;
  while ((match = createRegex.exec(content)) !== null) {
    actions.push({
      type: 'create',
      path: match[1],
      content: match[2],
      status: 'pending'
    });
  }

  // Tag regex for delete file: <file_delete path="..." />
  const deleteRegex = /<file_delete\s+path="([^"]+)"\s*\/>/g;
  let deleteMatch;
  while ((deleteMatch = deleteRegex.exec(content)) !== null) {
    actions.push({
      type: 'delete',
      path: deleteMatch[1],
      status: 'pending'
    });
  }

  return actions;
};

// Remove file action tags from markdown content so users don't see raw XML blocks
const cleanMarkdownContent = (content: string): string => {
  let cleaned = content;
  // Strip completed <file_create> blocks
  cleaned = cleaned.replace(/<file_create\s+path="([^"]+)">[\s\S]*?<\/file_create>/g, '');
  // Strip completed <file_delete> blocks
  cleaned = cleaned.replace(/<file_delete\s+path="([^"]+)"\s*\/>/g, '');
  // Clean unclosed <file_create> block (during active stream)
  cleaned = cleaned.replace(/<file_create\s+path="([^"]+)">[\s\S]*$/g, '\n*(Writing file `$1`...)*');
  return cleaned.trim();
};

// Beautiful visual feedback container for Codex operations inside chat bubble
const CodexActionLog = ({ actions }: { actions: FileAction[] }) => {
  return (
    <div className="mt-4 border border-indigo-100 rounded-xl bg-indigo-50/20 p-3 py-2 font-sans overflow-hidden">
      <div className="flex items-center gap-2 pb-1.5 border-b border-indigo-50/70">
        <Zap size={13} className="text-indigo-600 fill-indigo-200/50" />
        <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest font-mono">CDX WORKSPACE EXECUTION</span>
      </div>
      <div className="space-y-1 mt-2">
        {actions.map((act, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs bg-white border border-gray-100 rounded-lg p-2 hover:shadow-3xs transition-shadow">
            <div className="flex items-center gap-2 min-w-0">
              {act.type === 'create' ? (
                <span className="bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-tight flex-shrink-0 font-mono">WRITE</span>
              ) : (
                <span className="bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-tight flex-shrink-0 font-mono font-bold">DELETE</span>
              )}
              <span className="font-mono text-[10px] text-gray-700 truncate" title={act.path}>{act.path}</span>
            </div>
            
            <div className="flex items-center gap-2 pl-2 flex-shrink-0">
              {act.status === 'pending' && (
                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <span>WAITING</span>
                </div>
              )}
              {act.status === 'running' && (
                <div className="flex items-center gap-1.5 text-[9px] text-indigo-500 font-bold font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>SAVING</span>
                </div>
              )}
              {act.status === 'success' && (
                <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold font-mono">
                  <Check size={11} className="stroke-[3]" />
                  <span>SAVED</span>
                </div>
              )}
              {act.status === 'failed' && (
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1 text-[9px] text-rose-600 font-bold font-mono">
                    <span>FAILED</span>
                  </div>
                  {act.error && (
                    <span className="text-[7.5px] text-rose-400 font-mono mt-0.5 leading-none max-w-[120px] truncate" title={act.error}>
                      {act.error}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ModelMode>('fast');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [context, setContext] = useState('');
  const [contextMetadata, setContextMetadata] = useState<{ 
    loaded: string[]; 
    skipped: string[]; 
    size: number;
    folders: FolderData[];
  }>({ loaded: [], skipped: [], size: 0, folders: [] });
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:3000');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [companionInfo, setCompanionInfo] = useState<{ path?: string; apiVersion?: string; writeAccess?: boolean }>({});

  // Advanced File Inspector States
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const downloadHistory = () => {
    try {
      const dataStr = JSON.stringify({
        messages,
        mode,
        apiUrl,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'History.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to export history: ${err.message || String(err)}`);
    }
  };

  const handleImportHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json && Array.isArray(json.messages)) {
          setMessages(json.messages);
          if (json.mode) setMode(json.mode);
          if (json.apiUrl) setApiUrl(json.apiUrl);
          alert(`Success! Imported ${json.messages.length} messages.`);
          setIsSettingsOpen(false);
        } else if (Array.isArray(json)) {
          setMessages(json);
          alert(`Success! Imported ${json.length} messages.`);
          setIsSettingsOpen(false);
        } else {
          alert("Invalid History.json structure. Could not find messages array.");
        }
      } catch (err: any) {
        alert(`Failed to import JSON file: ${err.message || String(err)}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSelectFile = async (fileName: string) => {
    setSelectedFile(fileName);
    setSelectedFileContent(null);
    setIsFileLoading(true);
    setIsContextOpen(false); // Close tree overlay to focus on code contents
    try {
      const response = await fetch(`${apiUrl}/api/file-content?name=${encodeURIComponent(fileName)}`);
      if (response.ok) {
        const text = await response.text();
        setSelectedFileContent(text);
      } else {
        setSelectedFileContent(`Error loading file content: HTTP ${response.status}\n\nMake sure the companion server in your environment is active.`);
      }
    } catch (err: any) {
      setSelectedFileContent(`Error connecting to companion server to fetch ${fileName}:\n\n${err.message || String(err)}`);
    } finally {
      setIsFileLoading(false);
    }
  };

  const triggerFileAIAction = (actionType: 'explain' | 'bugs' | 'refactor' | 'tests' | 'inject') => {
    if (!selectedFile) return;
    
    let promptText = "";
    switch (actionType) {
      case 'explain':
        promptText = `Examine "${selectedFile}" and explain its functionality. List its key components, dependencies, configuration details, and logical flow in a highly professional, bite-sized engineer review.`;
        break;
      case 'bugs':
        promptText = `Run a comprehensive [LUALINT & COMPILER PASS] on "${selectedFile}". Analyze the full code logic for:
- Logical flaws (nil reference vulnerabilities, unvetted params)
- Scope management (any global leaks or missing 'local' declarations)
- Syntax edge cases (mismatched controls or structural problems)

Provide your clear findings and deliver the fully updated, robust codebase inside a <file_create path="${selectedFile}"> container. Make sure you don't use comments like "-- rest of code", write the complete, ready for production script.`;
        break;
      case 'refactor':
        promptText = `Perform a performance-focused architectural refactoring on "${selectedFile}". Make it state-of-the-art:
- Introduce high-performance local variable caching for global API functions (e.g., math, string, table lookups).
- Replace nested if-else structures with highly efficient table-driven state managers or declarative architectures.
- Refactor the procedural layout to clean, encapsulated Object-Oriented style using metatables and constructors.

Supply this highly optimized code inside a <file_create path="${selectedFile}"> container.`;
        break;
      case 'tests':
        promptText = `Construct a robust unit testing module for "${selectedFile}" to guarantee complete code path and logic coverage. Include assertions for positive paths, early error validation failures, and nil/extreme parameter checks. Produce this testing module to a fresh spec script file "tests/${selectedFile.replace(/\.[^/.]+$/, "")}_spec.lua" inside a <file_create> container.`;
        break;
      case 'inject':
        promptText = `Let's work together to customize "${selectedFile}". What would you like to update? Here is the file reference.`;
        break;
    }

    if (actionType === 'inject') {
      setInput(`Please review this codebase file "${selectedFile}":\n\n`);
    } else {
      setInput(promptText);
    }
    
    setSelectedFile(null); // Compact UI drawer focus on core chat after action triggered
  };

  // Periodic network monitoring of the companion server connection status
  useEffect(() => {
    let isMounted = true;
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch(`${apiUrl}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const info = await res.json();
          if (isMounted) {
            setConnectionStatus('online');
            setCompanionInfo({
              path: info.path,
              apiVersion: info.apiVersion,
              writeAccess: info.writeAccess
            });
          }
        } else {
          throw new Error('Not OK');
        }
      } catch (err) {
        if (isMounted) {
          setConnectionStatus('offline');
          setCompanionInfo({});
        }
      }
    };

    checkConnection();
    const timer = setInterval(checkConnection, 8000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [apiUrl]);

  // Automatically load files from the API (Remote storage or local Files)
  const refreshContext = async () => {
    setFetchError(null);
    try {
      // Use the bundle endpoint for high-speed, all-in-one content ingestion
      const response = await fetch(`${apiUrl}/api/bundle`);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data = await response.json();
      
      if (!data || !data.bundle || data.bundle.trim() === "") {
        console.log("No data bundle found. Data:", data);
        setContext(`INFO: No files were found. Path: ${data?.path || "Unknown"}\nAI Intelligence is currently EMPTY.`);
        setContextMetadata({ loaded: [], skipped: [], size: 0, folders: [] });
        return;
      }

      // Metadata summary
      const metaContext = `CODEBASE SUMMARY (FULL SNAPSHOT):
Source Path: ${data.path || "Unknown"}
Files Analyzed: ${data.count || "Unknown"}
Total Intelligence Context: ${Math.round((data.bundle.length / 1024) * 10) / 10} KB
--------------------------------------------------\n`;

      setContext(metaContext + data.bundle);
      setContextMetadata({ 
        loaded: data.fileNames || [], 
        skipped: data.bundle.includes('[!!! CONTEXT TRUNCATED') ? ['Some files skipped due to size limits'] : [], 
        size: data.bundle.length,
        folders: data.folders || []
      });

    } catch (error: any) {
      console.error("Failed to load bundle from API:", error);
      const msg = error.message || String(error);
      setFetchError(msg);
      setContext(`ERROR: Failed to connect to local API at ${apiUrl}.\nReason: ${msg}\n\nTIP: Ensure your local Node.js server is running and your browser allows Mixed Content.`);
      setContextMetadata({ loaded: [], skipped: [], size: 0, folders: [] });
    }
  };

  useEffect(() => {
    refreshContext();
  }, [apiUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleNewChat = () => {
    if (confirm('Are you sure you want to clear the current chat? This cannot be undone.')) {
      setMessages([]);
      setInput('');
      setIsSettingsOpen(false);
      setIsContextOpen(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Initial assistant message placeholder
    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      let fullResponse = "";
      for await (const chunk of generateChatStream(currentInput, mode, context, messages)) {
        fullResponse += chunk;
        setMessages((prev) => 
          prev.map(msg => msg.id === assistantId ? { ...msg, content: fullResponse } : msg)
        );
      }

      // Stream Finished -> Parse and run Codex workspace operations
      const parsedActions = parseFileActions(fullResponse);
      if (parsedActions.length > 0) {
        // Set actions in state
        setMessages((prev) => 
          prev.map(msg => msg.id === assistantId ? { ...msg, actions: parsedActions } : msg)
        );

        // Run actions sequentially
        for (let i = 0; i < parsedActions.length; i++) {
          const act = parsedActions[i];
          
          // Set to running
          setMessages((prev) => 
            prev.map(msg => {
              if (msg.id === assistantId && msg.actions) {
                const updated = [...msg.actions];
                updated[i] = { ...updated[i], status: 'running' };
                return { ...msg, actions: updated };
              }
              return msg;
            })
          );

          try {
            let res;
            if (act.type === 'create') {
              res = await fetch(`${apiUrl}/api/save-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: act.path, content: act.content })
              });
            } else {
              res = await fetch(`${apiUrl}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: act.path })
              });
            }

            if (!res.ok) {
              const errInfo = await res.json().catch(() => ({}));
              throw new Error(errInfo.error || `HTTP ${res.status}`);
            }

            // Success
            setMessages((prev) => 
              prev.map(msg => {
                if (msg.id === assistantId && msg.actions) {
                  const updated = [...msg.actions];
                  updated[i] = { ...updated[i], status: 'success' };
                  return { ...msg, actions: updated };
                }
                return msg;
              })
            );

          } catch (err: any) {
            console.error("Action run error:", err);
            // Failed
            setMessages((prev) => 
              prev.map(msg => {
                if (msg.id === assistantId && msg.actions) {
                  const updated = [...msg.actions];
                  updated[i] = { ...updated[i], status: 'failed', error: err.message || String(err) };
                  return { ...msg, actions: updated };
                }
                return msg;
              })
            );
          }
        }

        // Re-read and bundle target directory to make AI aware of its changes
        await refreshContext();
      }

    } catch (err) {
      setMessages((prev) => 
        prev.map(msg => msg.id === assistantId ? { ...msg, content: 'Error: Failed to stream response. Please try again.' } : msg)
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 animate-pulse">
            <Zap size={20} className="fill-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">RunCode Codex AI</h1>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1 block">Autonomous Dev Workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative">
          <button 
            onClick={handleNewChat}
            disabled={messages.length === 0}
            className={`p-2 rounded-lg transition-all ${messages.length === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
            title="Start New Chat"
          >
            <Trash2 size={18} />
          </button>

          {/* Connection Status Indicator */}
          <div className="flex items-center">
            {connectionStatus === 'online' ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100/50 text-[9.5px] font-bold text-emerald-600 uppercase tracking-tight" title={`WATCHING: ${companionInfo.path || 'Local Workspace'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE (v{companionInfo.apiVersion || '1.0'})
              </span>
            ) : connectionStatus === 'checking' ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100/50 text-[9.5px] font-bold text-amber-600 uppercase tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                PINGING
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100/50 text-[9.5px] font-bold text-rose-600 uppercase tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                OFFLINE
              </span>
            )}
          </div>

          <button 
            onClick={() => setIsContextOpen(!isContextOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/50 text-[10px] font-bold text-indigo-500 uppercase tracking-tight hover:bg-indigo-100 transition-colors cursor-help"
          >
            <Sparkles size={10} className="text-indigo-400" />
            AI Intelligence: {context ? 'HIGH' : 'LOW'}
          </button>

          <AnimatePresence>
            {isContextOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl p-4 z-50 overflow-hidden"
              >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Codebase Intel</span>
                      <span className="text-[10px] font-mono text-indigo-500 font-bold">{Math.round(contextMetadata.size / 1024)} KB LOADED</span>
                    </div>
                    
                    {fetchError && (
                      <div className="bg-red-50 border border-red-100 p-2 rounded-lg">
                        <div className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                          Connection Error
                        </div>
                        <div className="text-[10px] text-red-600 mt-1 leading-tight">
                          {fetchError}. Ensure Termux is running and check browser mixed-content settings.
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-[9.5px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Indexed Scripts & Directories ({contextMetadata.loaded.length})
                        </div>
                        <FolderExplorer loaded={contextMetadata.loaded} folders={contextMetadata.folders} onSelectFile={handleSelectFile} />
                      </div>

                      {contextMetadata.skipped && contextMetadata.skipped.length > 0 && (
                        <div className="bg-amber-50 border border-amber-100 p-2 rounded-lg">
                          <div className="text-[9px] font-bold text-amber-600 uppercase flex items-center gap-1">
                            <Zap size={11} className="fill-amber-500" />
                            Context Truncated ({contextMetadata.skipped.length})
                          </div>
                          <div className="text-[10px] text-amber-700 mt-1 leading-tight font-medium">
                             The codebase exceeds 1M characters. Some files were skipped to prevent Gemini API errors.
                          </div>
                        </div>
                      )}
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
          <div className={`w-1.5 h-1.5 rounded-full ${mode === 'expert' ? 'bg-indigo-400 animate-pulse' : 'bg-blue-400'}`} />
          {mode === 'expert' ? 'Expert' : 'Fast'} mode
        </div>
        </div>
      </header>

      {/* Messages */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 shadow-sm border border-indigo-100/50">
              <Bot size={28} />
            </div>
            <h2 className="font-bold text-lg text-gray-800 tracking-tight">Lead Lua Architect</h2>
            <p className="text-xs text-gray-500 max-w-sm mt-2 leading-relaxed">
              Autonomous compiler-level companion. The AI automatically ingests and understands your entire workspace codebase in real-time. Ask questions, request new features, or trigger full codebase refactorings.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[90%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 ${
                msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`rounded-2xl p-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-black text-white rounded-tr-none' 
                  : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-none'
              }`}>
                <div className={msg.role === 'user' ? 'text-sm' : 'prose prose-sm prose-indigo max-w-none'}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: CodeBlock,
                      p: ({ children }) => <div className="mb-4 last:mb-0 block">{children}</div>
                    }}
                  >
                    {msg.role === 'assistant' ? cleanMarkdownContent(msg.content) : msg.content}
                  </ReactMarkdown>
                  
                  {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                    <CodexActionLog actions={msg.actions} />
                  )}
                </div>
                <div className={`flex items-center gap-3 mt-3 pt-2 border-t border-black/5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <button 
                    onClick={() => handleCopyMessage(msg.content)}
                    className={`p-1.5 rounded-md hover:bg-black/5 transition-colors ${msg.role === 'user' ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Copy response"
                  >
                    <Copy size={12} />
                  </button>
                  <div className={`text-[9px] opacity-30 font-medium`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start pl-10">
            <div className="flex gap-1 animate-pulse items-center">
              <span className="text-[10px] text-indigo-500 font-bold font-mono tracking-widest mr-1 uppercase">CODING INTERPRETER ACTIVE</span>
              <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-duration:0.8s]" />
              <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.1s]" />
              <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]" />
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="px-4 py-5 bg-white border-t border-gray-50 pb-safe">
        <div className="max-w-3xl mx-auto">
          {/* Quick AI Refactoring Presets Floating row */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3.5 justify-center">
              {[
                { label: "🔍 Full Project Review", prompt: "Perform a comprehensive full project review. Scan directory design patterns, file communication structures, and summarize top structural recommendations." },
                { label: "🛡️ Runtime Security Check", prompt: "Audit my current file structures for logical safety loopholes, dangerous global variables, leak vulnerabilities, and secure data sandboxes." },
                { label: "📦 State Machine Refactor", prompt: "Examine procedural layouts across my scripts, determine high-performance table-driven state hierarchies, and provide refactoring metrics." }
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(chip.prompt)}
                  className="flex flex-col items-start text-left px-3.5 py-1.5 rounded-xl bg-gray-50 hover:bg-indigo-50/50 hover:border-indigo-200 border border-gray-100 transition-all cursor-pointer font-sans select-none active:scale-95"
                >
                  <span className="text-[10.5px] font-bold text-gray-700 leading-normal">{chip.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 relative bg-gray-50 p-2 rounded-2xl border border-gray-100 focus-within:bg-white focus-within:border-gray-200 transition-all shadow-sm">
            <button 
              id="settings-button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2.5 rounded-xl transition-all ${isSettingsOpen ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}
            >
              <Settings size={20} />
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  className="absolute bottom-full mb-4 left-0 bg-white border border-gray-100 rounded-2xl shadow-2xl p-3.5 z-20 w-80 border-b-4 border-gray-100"
                >
                  <div className="px-1 py-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-2">Select Engine</div>
                  <button
                    id="expert-mode"
                    onClick={() => { setMode('expert'); setIsSettingsOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${mode === 'expert' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles size={15} className={mode === 'expert' ? 'text-indigo-600' : 'text-indigo-400'} />
                      <span>Gemini 3.1 Pro (Expert)</span>
                    </div>
                    {mode === 'expert' && <Shield size={12} className="text-indigo-500" />}
                  </button>
                  <button
                    id="fast-mode"
                    onClick={() => { setMode('fast'); setIsSettingsOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${mode === 'fast' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Zap size={15} className={mode === 'fast' ? 'text-blue-600' : 'text-blue-400'} />
                      <span>Gemini 3.5 Flash (Fast)</span>
                    </div>
                    {mode === 'fast' && <Shield size={12} className="text-blue-500" />}
                  </button>

                  <div className="px-1 py-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest border-t border-gray-50 mt-2">API URL (Termux)</div>
                  <div className="px-1 pb-1">
                     <input 
                       type="text" 
                       value={apiUrl}
                       onChange={(e) => setApiUrl(e.target.value)}
                       className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-[11px] font-mono focus:ring-1 focus:ring-indigo-200 outline-none"
                       placeholder="http://localhost:3000"
                     />
                     <button 
                       onClick={() => refreshContext()}
                       className="w-full mt-2 bg-indigo-500 text-white text-[10.5px] font-bold py-1.5 rounded-lg hover:bg-indigo-600 transition-colors shadow-xs"
                     >
                       REFRESH FILES
                     </button>

                     <div className="px-1 py-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest border-t border-gray-50 mt-3.5 pt-2">Backup & Restore</div>
                     <div className="flex gap-2.5 mt-2">
                       <button
                         onClick={downloadHistory}
                         className="flex-1 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 border border-gray-100 rounded-xl py-2 text-[10.5px] font-bold transition-all text-gray-600 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95"
                         title="Download History.json"
                       >
                         <Download size={13} className="text-gray-400 group-hover:text-indigo-500" />
                         <span>Download</span>
                       </button>
                       <button
                         onClick={() => importFileInputRef.current?.click()}
                         className="flex-1 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 border border-gray-100 rounded-xl py-2 text-[10.5px] font-bold transition-all text-gray-600 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95"
                         title="Import History.json"
                       >
                         <Upload size={13} className="text-gray-400 group-hover:text-indigo-500" />
                         <span>Import Data</span>
                       </button>
                     </div>
                     <input 
                       type="file" 
                       ref={importFileInputRef} 
                       onChange={handleImportHistory} 
                       className="hidden" 
                       accept=".json" 
                     />

                     {/* Direct Termux diagnostics and instructions */}
                     {connectionStatus === 'online' ? (
                       <div className="mt-3 text-[10px] text-emerald-700 bg-emerald-50 rounded-xl p-2.5 border border-emerald-100/50 leading-snug">
                         <div className="font-bold flex items-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           CONNECTED
                         </div>
                         <div className="mt-1 font-mono text-[9px] break-all">
                           <strong>Path:</strong> {companionInfo.path || 'Loading...'}<br />
                           <strong>Write mode:</strong> {companionInfo.writeAccess ? 'Permitted ✓' : 'ReadOnly ⚠'}
                         </div>
                       </div>
                     ) : (
                       <div className="mt-3 text-[10px] text-amber-700 bg-amber-50/50 rounded-xl p-2.5 border border-amber-100/50 leading-relaxed font-sans">
                         <div className="font-bold text-amber-800 flex items-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                           OFFLINE DIAGNOSTICS:
                         </div>
                         <ul className="list-disc pl-4 space-y-1 mt-1 text-[9px] text-gray-600">
                           <li>Confirm script is running in Termux via <code className="bg-white/80 border border-gray-100 px-1 font-mono rounded">node index.js</code></li>
                           <li><strong>Security rule block:</strong> Tunnels are HTTPS. Local is HTTP. Click browser padlock/shield icon next to url and choose <strong>"Allow Insecure Content"</strong> (or Mixed Content).</li>
                           <li><strong>Secure link alternative:</strong> Run <code className="bg-white/80 border border-gray-100 px-1 font-mono rounded">npx localtunnel --port 3000</code> and paste your custom HTTPS address above.</li>
                         </ul>
                       </div>
                     )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <textarea
              id="message-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="How can I help you today?"
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-2 text-sm max-h-32 placeholder:text-gray-300"
            />
            
            <button
              id="send-button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-2.5 rounded-xl transition-all ${
                !input.trim() || isLoading 
                  ? 'text-gray-200' 
                  : 'bg-indigo-600 text-white shadow-indigo-200 shadow-lg hover:bg-indigo-700'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </footer>

      {/* Interactive Code Inspector overlay drawer */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-3xs z-50 flex justify-end"
          >
            {/* Overlay background dim toggle click to close */}
            <div className="absolute inset-0" onClick={() => setSelectedFile(null)} />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-gray-150"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-500">
                    <FileCode size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-sm text-gray-800 font-mono truncate" title={selectedFile}>{selectedFile}</h2>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block leading-none mt-1">CONTEXTUAL COMPILED CODE FILE</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 px-2.5 text-xs font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-100"
                >
                  CLOSE
                </button>
              </div>

              {/* Multi-Tool Deep Developer Coding Actions Row */}
              <div className="p-4 bg-indigo-50/20 border-b border-indigo-100/30 grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
                <button
                  onClick={() => triggerFileAIAction('explain')}
                  className="flex items-center gap-1.5 justify-center px-3 py-2 rounded-xl bg-white border border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50 text-[10.5px] font-bold text-indigo-700 transition-all cursor-pointer shadow-3xs active:scale-95"
                >
                  <HelpCircle size={13} />
                  <span>Explain logic</span>
                </button>
                <button
                  onClick={() => triggerFileAIAction('bugs')}
                  className="flex items-center gap-1.5 justify-center px-3 py-2 rounded-xl bg-white border border-rose-100 hover:border-rose-200 hover:bg-rose-50 text-[10.5px] font-bold text-rose-700 transition-all cursor-pointer shadow-3xs active:scale-95"
                >
                  <Bot size={13} className="text-rose-500" />
                  <span>Autofix bug</span>
                </button>
                <button
                  onClick={() => triggerFileAIAction('refactor')}
                  className="flex items-center gap-1.5 justify-center px-3 py-2 rounded-xl bg-white border border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50 text-[10.5px] font-bold text-emerald-700 transition-all cursor-pointer shadow-3xs active:scale-95"
                >
                  <Zap size={13} className="text-emerald-500" />
                  <span>OOP metatable</span>
                </button>
                <button
                  onClick={() => triggerFileAIAction('tests')}
                  className="flex items-center gap-1.5 justify-center px-3 py-2 rounded-xl bg-white border border-amber-100 hover:border-amber-200 hover:bg-amber-50 text-[10.5px] font-bold text-amber-700 transition-all cursor-pointer shadow-3xs active:scale-95"
                >
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Write Spec</span>
                </button>
              </div>

              {/* Code viewer box */}
              <div className="flex-1 overflow-y-auto p-5 bg-[#121212] font-mono text-[12px] leading-relaxed text-gray-200 scrollbar-thin">
                {isFileLoading ? (
                  <div className="h-full flex items-center justify-center flex-col gap-3">
                    <RefreshCw className="animate-spin text-indigo-500" size={24} />
                    <span className="text-xs text-gray-400 font-bold tracking-widest uppercase">Streaming raw Lua...</span>
                  </div>
                ) : selectedFileContent ? (
                  <pre className="whitespace-pre overflow-x-auto selection:bg-indigo-500/30">
                    <code>{selectedFileContent}</code>
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500 italic">
                    Could not fetch target file contents.
                  </div>
                )}
              </div>

              {/* Injection drawer form */}
              <div className="p-4 border-t border-gray-150 flex items-center gap-2.5 bg-gray-50 flex-shrink-0">
                <input 
                  type="text"
                  placeholder={`Ask custom questions on "${selectedFile}" ...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value;
                      if (val.trim()) {
                        setInput(`Regarding file "${selectedFile}": ${val}`);
                        setSelectedFile(null);
                      }
                    }
                  }}
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-indigo-300 outline-none shadow-3xs font-medium"
                />
                <button
                  onClick={() => triggerFileAIAction('inject')}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  Apply context
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


