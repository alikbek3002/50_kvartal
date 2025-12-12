# 🚀 Деплой на Railway с хранением картинок

## Шаги настройки:

### 1️⃣ Создайте PostgreSQL базу данных
1. В Railway создайте новый **PostgreSQL** сервис
2. Скопируйте `DATABASE_URL` из переменных окружения

### 2️⃣ Создайте таблицу в БД
1. Подключитесь к БД через Railway или используйте `psql`
2. Выполните SQL из файла `server/init.sql`

### 3️⃣ Деплой бэкенда на Railway
1. В Railway создайте новый сервис из репозитория
2. Укажите **Root Directory**: `server`
3. Добавьте переменные окружения:
   - `DATABASE_URL` - подключение к PostgreSQL
   - `NODE_ENV=production`
   - `PORT=3001` (Railway сам установит)

### 4️⃣ Добавьте Volume для картинок
1. В настройках сервера → **Volumes**
2. Нажмите **Add Volume**
3. Mount Path: `/app/uploads`
4. Сохраните и передеплойте

### 5️⃣ Обновите фронтенд
В вашем React приложении добавьте API URL:
```javascript
// src/config.js
export const API_URL = 'https://your-railway-app.up.railway.app';
```

## 📝 API Endpoints:

- `POST /api/upload` - загрузка изображения
- `GET /api/products` - получить все товары
- `POST /api/products` - создать товар
- `PUT /api/products/:id` - обновить товар
- `DELETE /api/products/:id` - удалить товар

## 💡 Пример использования в админке:

```javascript
// Загрузка изображения
const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  return data.url; // URL изображения
};

// Создание товара
const createProduct = async (productData) => {
  const response = await fetch(`${API_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });
  
  return response.json();
};
```

## 🔧 Локальная разработка:

```bash
cd server
npm install
cp .env.example .env
# Заполните .env своими данными
npm run dev
```

Сервер запустится на http://localhost:3001
