import React, { useState } from 'react';
import { MdDocument } from '../types';
import { FileText, Plus, Save, Trash2, Edit3, Eye, Check } from 'lucide-react';

interface DocumentsManagerProps {
  documents: MdDocument[];
  onSaveDocument: (filename: string, content: string) => Promise<void>;
  onDeleteDocument: (filename: string) => Promise<void>;
}

export const DocumentsManager: React.FC<DocumentsManagerProps> = ({
  documents,
  onSaveDocument,
  onDeleteDocument
}) => {
  const [selectedFile, setSelectedFile] = useState<string>(documents[0]?.filename || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  const currentDoc = documents.find(d => d.filename === selectedFile) || documents[0];

  const handleStartEdit = () => {
    if (currentDoc) {
      setEditContent(currentDoc.content);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (isCreating) {
      if (!newFilename.trim()) return;
      const fn = newFilename.endsWith('.md') ? newFilename : `${newFilename}.md`;
      await onSaveDocument(fn, editContent);
      setSelectedFile(fn);
      setIsCreating(false);
      setIsEditing(false);
      setNewFilename('');
    } else if (currentDoc) {
      await onSaveDocument(currentDoc.filename, editContent);
      setIsEditing(false);
    }
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  return (
    <div id="markdown-data-explorer" className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-200">Almacén Markdown (/data)</h3>
            <p className="text-[11px] text-slate-400">Archivos locales orquestados por Jarvis</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setIsEditing(true);
            setEditContent('# Nueva Nota\n\n- Fecha: ' + new Date().toLocaleDateString());
            setNewFilename('nueva_nota.md');
          }}
          className="px-2.5 py-1 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono flex items-center gap-1 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo .MD</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        {/* File List */}
        <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto">
          {documents.map(doc => {
            const isSelected = doc.filename === selectedFile;
            return (
              <button
                key={doc.filename}
                type="button"
                onClick={() => {
                  setSelectedFile(doc.filename);
                  setIsEditing(false);
                  setIsCreating(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="text-xs font-semibold text-slate-200 truncate">{doc.title}</div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">{doc.filename}</div>
                </div>
                <span className="text-[9px] font-mono text-slate-500">
                  {new Date(doc.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </button>
            );
          })}
        </div>

        {/* File Viewer / Editor */}
        <div className="col-span-2 p-4 flex flex-col justify-between space-y-3">
          {currentDoc || isCreating ? (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                {isCreating ? (
                  <input
                    type="text"
                    value={newFilename}
                    onChange={e => setNewFilename(e.target.value)}
                    placeholder="nombre_archivo.md"
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300 focus:outline-none"
                  />
                ) : (
                  <div>
                    <span className="text-xs font-bold font-mono text-cyan-400">/data/{currentDoc?.filename}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      Última modificación: {new Date(currentDoc?.updatedAt || '').toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {savedBadge && (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Guardado
                    </span>
                  )}
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => currentDoc && onDeleteDocument(currentDoc.filename)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Eliminar nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={12}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500/80"
                />
              ) : (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {currentDoc?.content}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              No hay documentos seleccionados en /data
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
