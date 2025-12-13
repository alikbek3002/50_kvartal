import { useEffect, useMemo, useState } from 'react'
import { API_URL } from './config'

const STORAGE_TOKEN_KEY = 'adminToken'

function getAuthHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path, { token, method = 'GET', headers, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getAuthHeader(token),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => null)

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? data.error : `HTTP ${response.status}`
    throw new Error(message)
  }

  return data
}

const emptyForm = {
  id: null,
  name: '',
  category: '',
  brand: '',
  stock: 0,
  pricePerDay: 100,
  imageUrl: '',
  description: '',
  isActive: true,
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_TOKEN_KEY) || '')
  const [authError, setAuthError] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState(emptyForm)
  const isEditing = useMemo(() => Boolean(form.id), [form.id])

  const loadProducts = async (activeToken) => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/admin/products', { token: activeToken })
      setProducts(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Ошибка загрузки товаров')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadProducts(token)
  }, [token])

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    setError('')

    try {
      const data = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: { username, password },
      })

      if (!data?.token) throw new Error('Не получен токен')

      localStorage.setItem(STORAGE_TOKEN_KEY, data.token)
      setToken(data.token)
      setPassword('')
      setUsername('')
    } catch (e) {
      setAuthError(e.message || 'Ошибка входа')
    }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    setToken('')
    setProducts([])
    setForm(emptyForm)
  }

  const startCreate = () => {
    setForm(emptyForm)
  }

  const startEdit = (p) => {
    setForm({
      id: p.id,
      name: p.name || '',
      category: p.category || '',
      brand: p.brand || '',
      stock: Number.isFinite(p.stock) ? p.stock : 0,
      pricePerDay: Number.isFinite(p.pricePerDay) ? p.pricePerDay : 100,
      imageUrl: p.imageUrl || '',
      description: p.description || '',
      isActive: p.isActive ?? true,
    })
  }

  const removeProduct = async (id) => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      await apiFetch(`/api/products/${id}`, { token, method: 'DELETE' })
      await loadProducts(token)
      if (form.id === id) setForm(emptyForm)
    } catch (e) {
      setError(e.message || 'Ошибка удаления')
    } finally {
      setLoading(false)
    }
  }

  const uploadImage = async (file) => {
    const fd = new FormData()
    fd.append('image', file)
    const data = await apiFetch('/api/upload', { token, method: 'POST', body: fd })
    return data?.url || ''
  }

  const saveProduct = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim() || null,
        stock: Number(form.stock) || 0,
        pricePerDay: Number(form.pricePerDay) || 100,
        imageUrl: form.imageUrl.trim() || null,
        description: form.description.trim() || null,
        isActive: Boolean(form.isActive),
      }

      if (!payload.name) throw new Error('Название обязательно')

      if (isEditing) {
        await apiFetch(`/api/products/${form.id}`, { token, method: 'PUT', body: payload })
      } else {
        await apiFetch('/api/products', { token, method: 'POST', body: payload })
      }

      setForm(emptyForm)
      await loadProducts(token)
    } catch (e) {
      setError(e.message || 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  if (!API_URL) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="container topbar__layout">
            <div className="topbar__brand">50 Квартал · Админ</div>
          </div>
        </header>
        <main className="page-content">
          <div className="container" style={{ maxWidth: 640 }}>
            <h1>Не настроен API</h1>
            <p className="lead">Нужно указать адрес бэкенда в переменной окружения.</p>
            <div className="cart-page" style={{ padding: 16 }}>
              <p style={{ margin: 0 }}>
                Задай <strong>VITE_API_URL</strong> (например, <code>http://localhost:3001</code> или URL Railway бэкенда), затем перезапусти админку.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="container topbar__layout">
            <div className="topbar__brand">50 Квартал · Админ</div>
          </div>
        </header>
        <main className="page-content">
          <div className="container" style={{ maxWidth: 560 }}>
            <h1>Вход</h1>
            <p className="lead">Введите логин и пароль менеджера.</p>
            <form onSubmit={handleLogin} className="checkout-page__form">
              <div className="form-group">
                <label>Логин</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="form-group">
                <label>Пароль</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>

              {authError && <div className="error-message">⚠️ {authError}</div>}

              <button className="button primary" type="submit">
                Войти
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="container topbar__layout">
          <div className="topbar__brand">50 Квартал · Админ</div>
          <div className="topbar__actions">
            <button className="button ghost" type="button" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="page-content">
        <div className="container">
          <div className="section__heading">
            <p className="eyebrow">Товары</p>
            <h2>Управление каталогом</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <div className="cart-page" style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Список товаров</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="button ghost" type="button" onClick={() => loadProducts(token)} disabled={loading}>
                    Обновить
                  </button>
                  <button className="button primary" type="button" onClick={startCreate} disabled={loading}>
                    Добавить товар
                  </button>
                </div>
              </div>

              {error && <div className="error-message" style={{ marginTop: 12 }}>⚠️ {error}</div>}

              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 8 }}>Название</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Категория</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Бренд</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Склад</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Цена/сутки</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>Активен</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <td style={{ padding: 8 }}>{p.name}</td>
                        <td style={{ padding: 8 }}>{p.category || '—'}</td>
                        <td style={{ padding: 8 }}>{p.brand || '—'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{p.stock ?? 0}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{p.pricePerDay ?? 100}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>{p.isActive ? 'Да' : 'Нет'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button className="button ghost" type="button" onClick={() => startEdit(p)}>
                              Редактировать
                            </button>
                            <button className="button ghost danger" type="button" onClick={() => removeProduct(p.id)}>
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!loading && products.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 12, opacity: 0.8 }}>Товаров пока нет</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="checkout-page__form-wrapper">
              <form onSubmit={saveProduct} className="checkout-page__form">
                <h3>{isEditing ? 'Редактирование товара' : 'Новый товар'}</h3>

                <div className="form-group">
                  <label>Название</label>
                  <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>

                <div className="form-group">
                  <label>Категория</label>
                  <input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Бренд</label>
                  <input value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Остаток (stock)</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                  />
                </div>

                <div className="form-group">
                  <label>Цена за сутки</label>
                  <input
                    type="number"
                    value={form.pricePerDay}
                    onChange={(e) => setForm((prev) => ({ ...prev, pricePerDay: Number(e.target.value) }))}
                  />
                </div>

                <div className="form-group">
                  <label>Ссылка на картинку (imageUrl)</label>
                  <input value={form.imageUrl} onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Загрузить картинку</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        setLoading(true)
                        const url = await uploadImage(file)
                        setForm((prev) => ({ ...prev, imageUrl: url }))
                      } catch (err) {
                        setError(err.message || 'Ошибка загрузки картинки')
                      } finally {
                        setLoading(false)
                      }
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Описание</label>
                  <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(form.isActive)}
                      onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />{' '}
                    Активен (показывать на сайте)
                  </label>
                </div>

                <div className="checkout-page__actions">
                  <button className="button ghost" type="button" onClick={() => setForm(emptyForm)} disabled={loading}>
                    Очистить
                  </button>
                  <button className="button primary" type="submit" disabled={loading}>
                    {loading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
