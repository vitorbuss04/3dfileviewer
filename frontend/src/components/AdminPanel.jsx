import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { generateThumbnailForModel } from '../utils/thumbnail';

export default function AdminPanel({ folders, onClose, onUploadSuccess }) {
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'folder'
  const [name, setName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('Geral');
  const [customFolder, setCustomFolder] = useState('');
  const [file, setFile] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  
  // Progress states
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentFileName: '', percentage: 0 });
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

  const handleFolderChange = (e) => {
    const files = Array.from(e.target.files);
    // Filter files to only keep .stl and .3mf
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ext === 'stl' || ext === '3mf';
    });
    
    setFolderFiles(validFiles);
    setError(null);
  };

  const uploadFileWithProgress = (file, name, folder) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('folder', folder || 'Geral');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/models', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const filePercent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            percentage: filePercent,
            currentFileName: file.name
          }));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Resposta inválida do servidor.'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || `Upload falhou com status ${xhr.status}`));
          } catch (e) {
            reject(new Error(`Erro de rede: status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Erro de conexão ao enviar o arquivo.'));
      };

      xhr.send(formData);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (uploadMode === 'file') {
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

      const folderName = selectedFolder === 'new' ? customFolder.trim() : selectedFolder;
      if (selectedFolder === 'new' && !folderName) {
        setError('Por favor, informe o nome da nova pasta.');
        setLoading(false);
        return;
      }

      try {
        const response = await uploadFileWithProgress(file, name.trim(), folderName);
        setLoadingMessage('Gerando foto de visualização automática...');
        try {
          await generateThumbnailForModel(response);
        } catch (thumbErr) {
          console.error('Thumbnail generation failed, using fallback:', thumbErr);
        }
        onUploadSuccess();
      } catch (err) {
        console.error('Upload error:', err);
        setError(err.message || 'Erro de conexão com o servidor.');
        setLoading(false);
      }
    } else {
      // Folder mode
      if (folderFiles.length === 0) {
        setError('Nenhum arquivo 3D (.stl, .3mf) foi detectado na pasta selecionada.');
        return;
      }

      setLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < folderFiles.length; i++) {
        const currentFile = folderFiles[i];
        
        // Update overall progress state
        setUploadProgress({
          current: i + 1,
          total: folderFiles.length,
          currentFileName: currentFile.name,
          percentage: 0
        });
        
        setLoadingMessage(`Enviando arquivo ${i + 1} de ${folderFiles.length}: ${currentFile.name}`);

        // Compute clean name and category
        const baseName = currentFile.name.substring(0, currentFile.name.lastIndexOf('.'));
        const cleanName = baseName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

        // Extract folder category from path
        const parts = currentFile.webkitRelativePath.split('/');
        const folderName = parts.length > 2 ? parts[1] : parts[0] || 'Geral';

        try {
          await uploadFileWithProgress(currentFile, cleanName, folderName);
          successCount++;
        } catch (err) {
          console.error(`Failed uploading folder file ${currentFile.name}:`, err);
          failCount++;
        }
      }

      if (successCount === 0) {
        setError('Todos os uploads da pasta falharam. Verifique a conexão.');
        setLoading(false);
      } else {
        setLoadingMessage('Importação concluída! Inicializando geração de miniaturas...');
        setTimeout(() => {
          onUploadSuccess();
        }, 1000);
      }
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

        <div className="upload-tabs">
          <button 
            type="button" 
            className={`upload-tab ${uploadMode === 'file' ? 'active' : ''}`}
            onClick={() => { setUploadMode('file'); setError(null); }}
            disabled={loading}
          >
            Enviar Arquivo
          </button>
          <button 
            type="button" 
            className={`upload-tab ${uploadMode === 'folder' ? 'active' : ''}`}
            onClick={() => { setUploadMode('folder'); setError(null); }}
            disabled={loading}
          >
            Enviar Pasta (Lote)
          </button>
        </div>

        <form className="upload-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {uploadMode === 'file' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Selecionar Pasta do Computador</label>
                <div className={`file-drop-area ${folderFiles.length > 0 ? 'has-file' : ''}`} style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    className="file-input"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderChange}
                    disabled={loading}
                    style={{ cursor: 'pointer' }}
                  />
                  <Upload className="file-drop-icon" size={32} />
                  {folderFiles.length > 0 ? (
                    <>
                      <div className="file-selected-name">
                        {folderFiles.length} modelos detectados
                      </div>
                      <div className="file-drop-info">
                        Pronto para importar em lote.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="file-drop-text">
                        Clique para selecionar uma <span>pasta com subpastas</span>
                      </div>
                      <div className="file-drop-info">
                        Verifica subpastas recursivamente e mapeia categorias.
                      </div>
                    </>
                  )}
                </div>
              </div>

              {folderFiles.length > 0 && !loading && (
                <div className="folder-preview-list" style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  background: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--color-text-main)', marginBottom: '0.15rem' }}>
                    Arquivos a serem importados:
                  </div>
                  {folderFiles.slice(0, 10).map((f, index) => (
                    <div key={index} style={{ color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      • {f.webkitRelativePath || f.name}
                    </div>
                  ))}
                  {folderFiles.length > 10 && (
                    <div style={{ color: 'var(--color-primary)', fontWeight: '600', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                      ... e mais {folderFiles.length - 10} arquivo(s).
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.5rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>
                  {loadingMessage}
                </span>
              </div>
              
              {uploadMode === 'folder' && uploadProgress.total > 0 && (
                <div className="folder-progress-wrapper" style={{ marginTop: '0.25rem' }}>
                  <div className="progress-text-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    <span>Progresso do Arquivo: {uploadProgress.percentage}%</span>
                    <span>Total: {uploadProgress.current} de {uploadProgress.total}</span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className="progress-bar-fg" style={{
                      height: '100%',
                      background: 'var(--color-primary)',
                      width: `${((uploadProgress.current - 1 + (uploadProgress.percentage / 100)) / uploadProgress.total) * 100}%`,
                      transition: 'width 0.1s linear',
                      borderRadius: '3px'
                    }}></div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading || (uploadMode === 'file' ? !file : folderFiles.length === 0)}>
              {loading ? 'Processando...' : uploadMode === 'file' ? 'Fazer Upload' : 'Importar Pasta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
