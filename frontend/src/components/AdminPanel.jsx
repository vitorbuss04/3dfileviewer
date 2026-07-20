import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { generateThumbnailForModel } from '../utils/thumbnail';

export default function AdminPanel({ folders, onClose, onUploadSuccess }) {
  const [name, setName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('Geral');
  const [customFolder, setCustomFolder] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext === 'stl' || ext === '3mf') {
        setFile(selectedFile);
        setError(null);
        // Autofill name if empty
        if (!name) {
          const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
          setName(baseName);
        }
      } else {
        setError('Apenas arquivos .stl e .3mf são permitidos.');
        setFile(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor, selecione um arquivo.');
      return;
    }
    if (!name.trim()) {
      setError('Por favor, informe um nome para o modelo.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Subindo arquivo 3D para o servidor...');
    setError(null);

    const folderName = selectedFolder === 'new' ? customFolder.trim() : selectedFolder;
    if (selectedFolder === 'new' && !folderName) {
      setError('Por favor, informe o nome da nova pasta.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name.trim());
    formData.append('folder', folderName || 'Geral');

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar upload do modelo.');
      }

      setLoadingMessage('Gerando foto de visualização automática...');
      try {
        const updatedModel = await generateThumbnailForModel(data);
        onUploadSuccess(updatedModel);
      } catch (thumbErr) {
        console.error('Thumbnail generation failed, using fallback:', thumbErr);
        onUploadSuccess(data); // still succeed if thumbnail generation fails
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-modal-header">
          <h3 className="upload-modal-title">Subir Novo Modelo 3D</h3>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="upload-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="modelName">Nome do Modelo</label>
            <input
              type="text"
              id="modelName"
              className="form-input"
              placeholder="Ex: Suporte de Filamento, Engrenagem M4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="modelFolder">Pasta / Categoria</label>
            <select
              id="modelFolder"
              className="form-input"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              disabled={loading}
            >
              {folders.filter(f => f !== 'Todos').map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
              <option value="new">+ Criar Nova Pasta...</option>
            </select>
          </div>

          {selectedFolder === 'new' && (
            <div className="form-group">
              <label className="form-label" htmlFor="customFolder">Nome da Nova Pasta</label>
              <input
                type="text"
                id="customFolder"
                className="form-input"
                placeholder="Ex: Decoração, Peças Impressora"
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Arquivo do Modelo (.stl, .3mf)</label>
            <div className={`file-drop-area ${file ? 'has-file' : ''}`}>
              <input
                type="file"
                className="file-input"
                accept=".stl,.3mf"
                onChange={handleFileChange}
                disabled={loading}
              />
              <Upload className="file-drop-icon" size={32} />
              {file ? (
                <>
                  <div className="file-selected-name" title={file.name}>{file.name}</div>
                  <div className="file-drop-info">
                    Tamanho: {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </>
              ) : (
                <>
                  <div className="file-drop-text">
                    Arraste o arquivo ou <span>clique para navegar</span>
                  </div>
                  <div className="file-drop-info">Formatos suportados: .stl e .3mf</div>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{loadingMessage}</span>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Processando...' : 'Fazer Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
