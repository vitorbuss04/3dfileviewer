# Diretriz: Arquitetura da Plataforma (DOE Framework)

Esta diretriz documenta a estrutura arquitetural da plataforma de visualização de modelos 3D, dividida em três camadas principais seguindo os princípios de consistência e divisão de responsabilidades.

---

## 3 Camadas Operacionais

### 1. Camada Diretiva (Directives)
- Localizada na pasta `directives/` na raiz do projeto.
- Contém documentações dos procedimentos e fluxos de dados, servindo de guia operacional para o desenvolvedor e o agente de IA.
- Arquivos:
  - `architecture.md`: Este guia geral.
  - `batch_import.md`: Procedimentos para importação de dados e arquivos locais.

### 2. Camada de Execução (Execution)
- Localizada na pasta `execution/` na raiz do projeto.
- Contém scripts e rotinas determinísticas de automação, gerenciamento e processamento de arquivos.
- Arquivos:
  - `batch_import.js`: Importador em lote que escaneia diretórios do computador por arquivos STL/3MF e os insere no banco de dados da plataforma.

### 3. Camada de Orquestração (Aplicação)
- A plataforma ativa em si, composta por:
  - **Backend (Express + SQLite)**: APIs para servir os modelos, deletá-los e gerenciar thumbnails.
  - **Frontend (React + Vite + Three.js)**: Grid interativo de listagem com suporte a paginação e visualizador 3D ereto com controle de cores e luz.

---

## Estrutura do Catálogo e Pastas

Os modelos de impressão 3D salvos fisicamente são armazenados no diretório `backend/uploads/` e vinculados no banco de dados `database.db`.
As categorias de pastas no menu lateral do frontend são construídas dinamicamente de acordo com o campo `folder` da tabela `models`.

---

## Desempenho e Boas Práticas

1. **Desacoplamento de CPU**: Qualquer parseamento pesado de binários (como leitura de malhas 3D de arquivos STL) deve ser realizado fora da thread de interface usando **Web Workers**.
2. **Uso de Cache**: Todos os recursos de uploads e mídias estáticas devem ser servidos com cabeçalhos HTTP de cache longo (`Cache-Control: public, max-age=31536000, immutable`) para evitar recarregamento desnecessário na rede.
