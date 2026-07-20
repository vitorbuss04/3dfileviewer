import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Search, 
  Upload, 
  Eye, 
  Download, 
  Trash2, 
  Boxes, 
  Calendar, 
  HardDrive,
  AlertCircle,
  FileCode
} from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import AdminPanel from './components/AdminPanel';
import { generateThumbnailForModel } from './utils/thumbnail';

export default function App() {
  const [models, setModels] = useState([]);
  const [activeFolder, setActiveFolder] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Lightweight page size for optimal performance

  // Reset pagination to first page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFolder, searchQuery]);

  // Fetch all models from backend
  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error('Não foi possível carregar os modelos 3D.');
      }
      const data = await response.json();
      setModels(data);
      setError(null);
    } catch (err) {
      console.error('Fetch models error:', err);
      setError('Erro ao se conectar com o servidor local. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  // Self-healing thumbnail generator queue (only processes models displayed on the current page!)
  useEffect(() => {
    if (loading || models.length === 0 || isGeneratingThumbnails) return;

    // Filter and slice models on the current page
    const matchesQuery = (model) => {
      const matchesFolder = activeFolder === 'Todos' || model.folder === activeFolder;
      const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            model.filename.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFolder && matchesSearch;
    };
    
    const pageModels = models
      .filter(matchesQuery)
      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Find the first model that does not have an imagepath on the current page
    const nextModel = pageModels.find(m => !m.imagepath);
    if (!nextModel) return;

    setIsGeneratingThumbnails(true);
    console.log(`Auto-generating thumbnail in background for model: ${nextModel.name}`);

    generateThumbnailForModel(nextModel)
      .then((updatedModel) => {
        setModels(prev => prev.map(m => m.id === updatedModel.id ? updatedModel : m));
      })
      .catch((err) => {
        console.error('Failed to auto-generate thumbnail for:', nextModel.name, err);
        // Mark as failed in state to prevent infinite retries in this session
        setModels(prev => prev.map(m => m.id === nextModel.id ? { ...m, imagepath: 'failed' } : m));
      })
      .finally(() => {
        setIsGeneratingThumbnails(false);
      });
  }, [models, loading, isGeneratingThumbnails, currentPage, activeFolder, searchQuery]);

  // Format File Size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format Date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Extract unique folders list dynamically
  const getFolderList = () => {
    const folderSet = new Set(['Geral']);
    models.forEach(model => {
      if (model.folder) {
        folderSet.add(model.folder);
      }
    });
    return ['Todos', ...Array.from(folderSet).sort()];
  };

  const folders = getFolderList();

  // Delete model
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este modelo permanentemente?')) {
      return;
    }

    try {
      const response = await fetch(`/api/models/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir modelo.');
      }

      // Remove from state
      setModels(models.filter(m => m.id !== id));
      
      // If deleted active folder and it becomes empty, go back to 'Todos'
      const updatedModels = models.filter(m => m.id !== id);
      const stillHasFolder = updatedModels.some(m => m.folder === activeFolder);
      if (activeFolder !== 'Todos' && activeFolder !== 'Geral' && !stillHasFolder) {
        setActiveFolder('Todos');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Download model file
  const handleDownload = (model, e) => {
    e.stopPropagation();
    // Create hidden anchor element to trigger download with correct name
    const link = document.createElement('a');
    link.href = model.filepath;
    link.download = model.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter models based on selection
  const filteredModels = models.filter((model) => {
    const matchesFolder = activeFolder === 'Todos' || model.folder === activeFolder;
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          model.filename.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const totalPages = Math.ceil(filteredModels.length / itemsPerPage);
  const paginatedModels = filteredModels.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getModelsCountInFolder = (folder) => {
    if (folder === 'Todos') return models.length;
    return models.filter(m => m.folder === folder).length;
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Boxes className="logo-icon" color="#6366f1" size={32} />
          <span className="logo-text">Vault3D</span>
        </div>

        <div className="admin-toggle-wrapper">
          <span className={`admin-toggle-label ${isAdminMode ? 'active' : ''}`}>
            Modo Administrador
          </span>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={isAdminMode} 
              onChange={(e) => setIsAdminMode(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <nav className="folder-nav">
          <h4 className="nav-title">Categorias</h4>
          <ul className="folder-list">
            {folders.map((folder) => (
              <li 
                key={folder}
                className={`folder-item ${activeFolder === folder ? 'active' : ''}`}
                onClick={() => setActiveFolder(folder)}
              >
                <div className="folder-item-left">
                  <Folder size={18} />
                  <span>{folder}</span>
                </div>
                <span className="folder-badge">{getModelsCountInFolder(folder)}</span>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-title-section">
            <h1 className="header-title">
              {activeFolder === 'Todos' ? 'Todos os Modelos' : `Pasta: ${activeFolder}`}
            </h1>
            <p className="header-subtitle">
              {filteredModels.length} modelo(s) encontrado(s) nesta categoria.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="search-bar-wrapper">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Pesquisar modelos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {isAdminMode && (
              <button className="btn-upload" onClick={() => setShowUploadModal(true)}>
                <Upload size={18} />
                <span>Upload 3D</span>
              </button>
            )}
          </div>
        </header>

        {/* Content State Handler */}
        {error ? (
          <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <AlertCircle size={48} color="#ef4444" style={{ opacity: 0.8 }} />
            <h3 style={{ color: '#f87171' }}>Falha na Conexão</h3>
            <p style={{ maxWidth: '400px', textAlign: 'center' }}>{error}</p>
            <button className="btn-upload" onClick={fetchModels} style={{ marginTop: '1rem' }}>
              Tentar Novamente
            </button>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ marginBottom: '1rem' }}></div>
            <p>Carregando catálogo de modelos 3D...</p>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="empty-state">
            <Boxes className="empty-icon" size={64} />
            <h3>Nenhum modelo encontrado</h3>
            <p>Não há modelos nesta categoria ou nenhum resultado corresponde à pesquisa.</p>
            {isAdminMode && (
              <button 
                className="btn-upload" 
                onClick={() => setShowUploadModal(true)}
                style={{ marginTop: '1rem' }}
              >
                Subir primeiro modelo
              </button>
            )}
          </div>
        ) : (
          /* Grid of Models + Pagination */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div className="models-grid">
              {paginatedModels.map((model) => {
                const fileExt = model.filename.split('.').pop().toLowerCase();
                return (
                  <div key={model.id} className="model-card">
                    {isAdminMode && (
                      <button 
                        className="btn-delete-card" 
                        onClick={(e) => handleDelete(model.id, e)}
                        title="Excluir Modelo"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <div className="card-visual">
                      <span className={`model-badge ${fileExt}`} style={{ zIndex: 2 }}>
                        {fileExt}
                      </span>
                      {model.imagepath && model.imagepath !== 'failed' ? (
                        <img 
                          src={model.imagepath} 
                          alt={model.name} 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            padding: '0.5rem',
                            transition: 'transform var(--transition-normal)'
                          }}
                          className="card-thumbnail"
                        />
                      ) : (
                        <FileCode className="card-icon" size={48} />
                      )}
                    </div>

                    <div className="card-info">
                      <h3 className="model-name" title={model.name}>{model.name}</h3>
                      
                      <div className="model-meta-list">
                        <div className="model-meta-item" title="Tamanho do arquivo">
                          <HardDrive size={12} />
                          <span>{formatSize(model.size)}</span>
                        </div>
                        <div className="model-meta-item" title="Data de upload">
                          <Calendar size={12} />
                          <span>{formatDate(model.upload_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button className="btn-view" onClick={() => setSelectedModel(model)}>
                        <Eye size={16} />
                        <span>Visualizar 3D</span>
                      </button>
                      
                      <button 
                        className="btn-download-icon" 
                        onClick={(e) => handleDownload(model, e)}
                        title="Baixar arquivo"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Admin Panel Modal (Upload) */}
      {showUploadModal && (
        <AdminPanel 
          folders={folders}
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={(newModel) => {
            setModels([newModel, ...models]);
            setShowUploadModal(false);
          }}
        />
      )}

      {/* 3D Visualizer Modal */}
      {selectedModel && (
        <ModelViewer 
          model={selectedModel}
          onClose={() => setSelectedModel(null)}
        />
      )}
    </div>
  );
}
