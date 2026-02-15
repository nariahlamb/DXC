import React, { useMemo, useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, Search, StickyNote, Tag, Star } from 'lucide-react';
import { NoteEntry } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import clsx from 'clsx';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: NoteEntry[];
  onUpdateNotes: (notes: NoteEntry[]) => void;
}

const createNoteId = () => `Note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowLabel = () => new Date().toLocaleString('zh-CN', { hour12: false });

export const NotesModal: React.FC<NotesModalProps> = ({ isOpen, onClose, notes, onUpdateNotes }) => {
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftImportant, setDraftImportant] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedId && notes.length > 0) {
      setSelectedId(notes[0].id);
    }
  }, [isOpen, notes, selectedId]);

  const filteredNotes = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter(n => {
      const titleMatch = (n.标题 || '').toLowerCase().includes(query);
      const contentMatch = (n.内容 || '').toLowerCase().includes(query);
      const tagMatch = (n.标签 || []).join(' ').toLowerCase().includes(query);
      return titleMatch || contentMatch || tagMatch;
    });
  }, [filter, notes]);

  const selectedNote = selectedId ? notes.find(n => n.id === selectedId) || null : null;

  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle('');
      setDraftContent('');
      setDraftTags('');
      setDraftImportant(false);
      return;
    }
    setDraftTitle(selectedNote.标题 || '');
    setDraftContent(selectedNote.内容 || '');
    setDraftTags((selectedNote.标签 || []).join('、'));
    setDraftImportant(!!selectedNote.重要);
  }, [selectedNote?.id]);

  const handleCreate = () => {
    const id = createNoteId();
    const nextNote: NoteEntry = {
      id,
      标题: 'Untitled Note',
      内容: '',
      标签: [],
      时间戳: nowLabel(),
      重要: false
    };
    onUpdateNotes([...notes, nextNote]);
    setSelectedId(id);
    setFilter('');
  };

  const handleSave = () => {
    if (!selectedNote) return;
    const cleanedTags = draftTags
      .split(/[，,]/)
      .map(t => t.trim())
      .filter(Boolean);
    const updated: NoteEntry = {
      ...selectedNote,
      标题: draftTitle.trim() || 'Untitled Note',
      内容: draftContent.trim(),
      标签: cleanedTags.length > 0 ? cleanedTags : undefined,
      重要: draftImportant,
      更新时间: nowLabel()
    };
    const nextNotes = notes.map(n => n.id === selectedNote.id ? updated : n);
    onUpdateNotes(nextNotes);
  };

  const handleDelete = () => {
    if (!selectedNote) return;
    if (!confirm('Delete this note?')) return;
    const nextNotes = notes.filter(n => n.id !== selectedNote.id);
    onUpdateNotes(nextNotes);
    setSelectedId(nextNotes[0]?.id || null);
  };

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="Notes & Intel"
        icon={<StickyNote size={20} />}
        size="l"
        theme="default"
        noBodyPadding
    >
        <div className="flex flex-col md:flex-row h-full">
            {/* Sidebar: List */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 bg-black/20 shrink-0 flex flex-col h-[40vh] md:h-full">
                <div className="p-3 border-b border-white/10 flex items-center gap-2 text-xs text-zinc-400">
                  <Search size={14} />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search..."
                    className="bg-transparent flex-1 outline-none text-zinc-200 placeholder:text-zinc-600 font-mono"
                  />
                  <button
                    onClick={handleCreate}
                    className="p-1 hover:text-white transition-colors"
                    title="New Note"
                  >
                      <Plus size={14} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {filteredNotes.length === 0 && (
                    <div className="text-center text-zinc-600 text-[10px] py-4 italic">No matching notes found.</div>
                  )}
                  {filteredNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => setSelectedId(note.id)}
                      className={clsx(
                          "w-full text-left p-3 border transition-all group relative overflow-hidden",
                          selectedId === note.id 
                            ? "bg-white/5 border-white/20 text-white" 
                            : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-bold text-xs truncate">{note.标题 || 'Untitled'}</div>
                        {note.重要 && <Star size={10} className="text-amber-400 fill-current" />}
                      </div>
                      <div className="flex items-center justify-between">
                          <div className="text-[9px] font-mono text-zinc-600">{note.更新时间 || note.时间戳}</div>
                          {note.标签 && note.标签.length > 0 && (
                            <div className="text-[9px] text-cyan-500/70 flex items-center gap-1">
                              <Tag size={8} /> {note.标签[0]}
                            </div>
                          )}
                      </div>
                    </button>
                  ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gradient-to-br from-transparent to-zinc-900/50 h-full">
                {selectedNote ? (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Editor Header */}
                    <div className="flex items-center gap-3">
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="flex-1 bg-transparent border-b border-white/10 text-white px-2 py-2 text-xl font-display uppercase tracking-wide focus:border-cyan-500 transition-colors outline-none placeholder:text-zinc-700"
                        placeholder="Note Title"
                      />
                      <button
                        onClick={() => setDraftImportant(!draftImportant)}
                        className={clsx(
                            "p-2 border transition-all",
                            draftImportant ? "border-amber-500 text-amber-400 bg-amber-900/20" : "border-white/10 text-zinc-600 hover:text-zinc-400"
                        )}
                        title="Toggle Important"
                      >
                        <Star size={16} fill={draftImportant ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Tags Input */}
                    <div className="flex items-center gap-2 bg-black/20 border border-white/5 px-3 py-2 rounded-sm">
                      <Tag size={12} className="text-zinc-500" />
                      <input
                        value={draftTags}
                        onChange={(e) => setDraftTags(e.target.value)}
                        className="flex-1 bg-transparent border-none text-zinc-300 text-xs outline-none placeholder:text-zinc-700"
                        placeholder="Tags (comma separated)..."
                      />
                    </div>

                    {/* Content Area */}
                    <textarea
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        className="w-full min-h-[400px] bg-black/20 border border-white/5 text-zinc-300 px-4 py-4 resize-none outline-none focus:border-white/20 transition-colors text-sm leading-relaxed font-serif"
                        placeholder="Write your observations here..."
                    />

                    {/* Footer Controls */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="text-[10px] text-zinc-600 font-mono">
                          Last Updated: {selectedNote.更新时间 || selectedNote.时间戳}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                            onClick={handleDelete}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-2"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 bg-cyan-900/20 text-cyan-300 border border-cyan-500/30 px-6 py-2 hover:bg-cyan-900/40 hover:border-cyan-400 transition-all uppercase font-bold text-xs tracking-wider rounded-sm"
                        >
                            <Save size={14} /> Save Note
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-50">
                    <StickyNote size={48} className="mb-4" />
                    <div className="text-sm uppercase tracking-widest font-display">Select or Create a Note</div>
                  </div>
                )}
            </div>
        </div>
    </ModalWrapper>
  );
};