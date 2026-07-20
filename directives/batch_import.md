# Diretriz: Importação de Modelos em Lote

Esta diretriz descreve como rodar a importação em lote de arquivos STL e 3MF de pastas locais para o catálogo do visualizador 3D.

---

## Procedimento de Execução

1. **Localização do Script**:
   - O script determinístico vive na pasta de execução do projeto em: `execution/batch_import.js`.

2. **Configuração do Diretório de Origem**:
   - O script lê por padrão a pasta de downloads do usuário (`c:\Users\augus\Downloads\drive-download-20260720T122600Z-1-002`).
   - Se desejar importar de outra pasta, atualize a constante `sourceDir` no cabeçalho do arquivo `execution/batch_import.js`.

3. **Como Executar**:
   - Abra um terminal na raiz do projeto (`C:\Users\augus\.gemini\antigravity-ide\scratch\3d-model-platform`) e execute:
     ```bash
     node execution/batch_import.js
     ```

---

## Funcionamento Técnico

1. **Recursividade**: O script entra em todas as subpastas da origem procurando arquivos com extensão `.stl` ou `.3mf`.
2. **Atribuição de Categorias**: O nome da primeira subpasta encontrada é atribuído à coluna `folder` (categoria) no banco de dados (ex: `BOOFA - Table Lamp`), permitindo que a árvore do menu lateral do frontend seja gerada de forma limpa.
3. **Cópia Física**: Os arquivos originais são copiados com nomes únicos (com base em timestamp + randomizador) para a pasta `backend/uploads/` para evitar conflito de nomes repetidos.
4. **Auto-Geração de Thumbnail**: A importação cadastra a imagem como nula (`null`). O frontend cuidará de gerar as thumbnails em segundo plano de forma otimizada e paginada à medida que o usuário navega pela plataforma.
