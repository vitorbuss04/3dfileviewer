const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dbServices = require('./database');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads folder statically
app.use('/api/uploads', express.static(uploadsDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to accept only .stl/.3mf for 3D model and images for thumbnail
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'file') {
    if (ext === '.stl' || ext === '.3mf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .stl e .3mf são permitidos para o modelo 3D!'), false);
    }
  } else if (file.fieldname === 'image') {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens (.jpg, .png, .webp, .gif) são permitidas para a foto!'), false);
    }
  } else {
    cb(new Error('Campo inesperado no formulário.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// API Routes
app.get('/api/models', async (req, res) => {
  try {
    const models = await dbServices.getAllModels();
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Erro ao buscar modelos no banco de dados.' });
  }
});

app.post('/api/models', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  let fileSaved = null;
  let imageSaved = null;
  try {
    const files = req.files;
    
    if (files && files.file && files.file[0]) {
      fileSaved = files.file[0];
    }
    if (files && files.image && files.image[0]) {
      imageSaved = files.image[0];
    }

    if (!fileSaved) {
      if (imageSaved && fs.existsSync(imageSaved.path)) {
        fs.unlinkSync(imageSaved.path);
      }
      return res.status(400).json({ error: 'O arquivo do modelo 3D é obrigatório.' });
    }

    const { name, folder } = req.body;
    if (!name || name.trim() === '') {
      // Clean up uploaded files if name is missing
      if (fileSaved && fs.existsSync(fileSaved.path)) fs.unlinkSync(fileSaved.path);
      if (imageSaved && fs.existsSync(imageSaved.path)) fs.unlinkSync(imageSaved.path);
      return res.status(400).json({ error: 'O nome do modelo é obrigatório.' });
    }

    const filename = fileSaved.filename;
    const filepath = `/api/uploads/${filename}`;
    const size = fileSaved.size;
    const imagepath = imageSaved ? `/api/uploads/${imageSaved.filename}` : null;

    const newModel = await dbServices.insertModel(
      name,
      filename,
      filepath,
      folder || 'Geral',
      size,
      imagepath
    );

    res.status(201).json(newModel);
  } catch (error) {
    console.error('Error uploading model:', error);
    // Cleanup if files were saved
    if (fileSaved && fs.existsSync(fileSaved.path)) fs.unlinkSync(fileSaved.path);
    if (imageSaved && fs.existsSync(imageSaved.path)) fs.unlinkSync(imageSaved.path);
    res.status(500).json({ error: 'Erro interno ao salvar o modelo.' });
  }
});

app.delete('/api/models/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const model = await dbServices.getModelById(id);
    if (!model) {
      return res.status(404).json({ error: 'Modelo não encontrado.' });
    }

    // Delete 3D file from disk
    const fileFullPath = path.join(uploadsDir, model.filename);
    if (fs.existsSync(fileFullPath)) {
      fs.unlinkSync(fileFullPath);
    }

    // Delete image file from disk if it exists
    if (model.imagepath) {
      const imageFilename = path.basename(model.imagepath);
      const imageFullPath = path.join(uploadsDir, imageFilename);
      if (fs.existsSync(imageFullPath)) {
        fs.unlinkSync(imageFullPath);
      }
    }

    // Delete record from database
    await dbServices.deleteModel(id);
    res.json({ message: 'Modelo excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Erro ao excluir o modelo.' });
  }
});

app.post('/api/models/:id/thumbnail', async (req, res) => {
  try {
    const id = req.params.id;
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Dados da imagem não fornecidos.' });
    }

    const model = await dbServices.getModelById(id);
    if (!model) {
      return res.status(404).json({ error: 'Modelo não encontrado.' });
    }

    // Extract base64 content
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato de imagem inválido.' });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Save image to uploads folder
    const thumbnailFilename = `thumbnail-${id}-${Date.now()}.png`;
    const thumbnailPath = path.join(uploadsDir, thumbnailFilename);
    
    // Write file to disk
    fs.writeFileSync(thumbnailPath, imageBuffer);
    
    const imagepath = `/api/uploads/${thumbnailFilename}`;
    
    // Update DB
    await dbServices.updateModelImage(id, imagepath);
    
    // Clean up old thumbnail if it exists
    if (model.imagepath) {
      const oldFilename = path.basename(model.imagepath);
      const oldPath = path.join(uploadsDir, oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (unlinkErr) {
          // Ignore unlink errors
        }
      }
    }
    
    res.json({ message: 'Thumbnail gerada e salva com sucesso!', imagepath });
  } catch (error) {
    console.error('Error saving thumbnail:', error);
    res.status(500).json({ error: 'Erro ao salvar a thumbnail gerada.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
