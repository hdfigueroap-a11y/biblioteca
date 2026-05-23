# Sistema de Gestión de Biblioteca Universitaria

## Estructura
```
biblioteca/
├── backend/    → API REST Express + MySQL  (Railway)
└── frontend/   → Interfaz HTML/CSS/JS      (Vercel)
```

## Deploy

### Railway (backend)
1. New Project → Deploy from GitHub repo
2. Settings → Root Directory → `backend`
3. Agregar plugin MySQL
4. Agregar variable: `FRONTEND_URL=https://tu-app.vercel.app`

### Vercel (frontend)
1. New Project → importar este repo
2. Settings → Root Directory → `frontend`
3. Editar `index.html` → cambiar `API_URL` por la URL de Railway
