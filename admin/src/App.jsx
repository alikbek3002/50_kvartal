import { useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from './config'

const STORAGE_TOKEN_KEY = 'adminToken'

function getAuthHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path, { token, method = 'GET', headers, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getAuthHeader(token),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null)

  // Common Railway/Vite deploy pitfall: API_URL points to a static frontend service.
  // In that case, unknown /api/* routes often return index.html with 200 OK.
  if (response.ok && path.startsWith('/api/') && !contentType.includes('application/json')) {
    const preview = typeof data === 'string' ? data.slice(0, 120).replace(/\s+/g, ' ').trim() : ''
    const hint = preview.toLowerCase().includes('<!doctype html') || preview.toLowerCase().includes('<html')
      ? 'Похоже, API_URL указывает на фронтенд (вернулся HTML), а не на бэкенд.'
      : 'Бэкенд вернул не-JSON ответ.'
    throw new Error(`${hint} Проверь VITE_API_URL в Railway и пересобери админку. Ответ: ${contentType || 'unknown'}`)
  }

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
  stock: 1,
  pricePerDay: 100,
  imageUrls: [],
  description: '',
  equipment: '',
  specs: '',
  isActive: true,
}

function formatBrand(brand) {
  return brand && brand !== '—' ? brand : 'бренд уточняется'
}

function getProductImage(item) {
  const list = Array.isArray(item?.imageUrls) ? item.imageUrls : []
  const primary = (list[0] || item?.imageUrl || '').trim()
  if (primary) {
    if (API_URL && (primary.startsWith('/api/') || primary.startsWith('/uploads/'))) {
      return `${API_URL}${primary}`
    }
    return primary
  }
  return 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'
}

function resolveAdminImageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (API_URL && (url.startsWith('/api/') || url.startsWith('/uploads/'))) {
    return `${API_URL}${url}`
  }
  return url
}

function normalizeImageUrls(value) {
  const asString = typeof value === 'string' ? value : ''
  const urls = asString
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set()
  const unique = []
  for (const u of urls) {
    if (seen.has(u)) continue
    seen.add(u)
    unique.push(u)
    if (unique.length >= 12) break
  }
  return unique
}

function formatDateTimeRu(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_TOKEN_KEY) || '')
  const [authError, setAuthError] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uiModal, setUiModal] = useState(null)

  const [form, setForm] = useState(emptyForm)
  const isEditing = useMemo(() => Boolean(form.id), [form.id])
  const [productEditorOpen, setProductEditorOpen] = useState(false)
  const scrollLockRef = useRef({ locked: false, previousOverflow: '' })
  const [editorImageIndex, setEditorImageIndex] = useState(0)

  const editorImages = useMemo(() => {
    const list = Array.isArray(form?.imageUrls) ? form.imageUrls : []
    return list.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12)
  }, [form?.imageUrls])

  useEffect(() => {
    if (!productEditorOpen) return
    setEditorImageIndex(0)
  }, [productEditorOpen])

  useEffect(() => {
    if (!productEditorOpen) return
    setEditorImageIndex((prev) => {
      if (editorImages.length <= 0) return 0
      return Math.max(0, Math.min(prev, editorImages.length - 1))
    })
  }, [productEditorOpen, editorImages.length])

  const removeEditorImageAt = (index) => {
    const idx = Number(index)
    if (!Number.isFinite(idx) || idx < 0) return

    setForm((prev) => {
      const list = Array.isArray(prev?.imageUrls) ? prev.imageUrls : []
      const normalized = list.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12)
      if (idx >= normalized.length) return prev
      const next = normalized.filter((_, i) => i !== idx)
      return { ...prev, imageUrls: next }
    })

    setEditorImageIndex((current) => {
      const oldLen = editorImages.length
      const newLen = Math.max(0, oldLen - 1)
      if (newLen <= 0) return 0
      if (idx < current) return current - 1
      if (idx === current) return Math.min(current, newLen - 1)
      return Math.max(0, Math.min(current, newLen - 1))
    })
  }

  const [bookingProduct, setBookingProduct] = useState(null)
  const [bookingDateFrom, setBookingDateFrom] = useState('')
  const [bookingTimeFrom, setBookingTimeFrom] = useState('09:00')
  const [bookingDateTo, setBookingDateTo] = useState('')
  const [bookingTimeTo, setBookingTimeTo] = useState('21:00')
  const [bookingQuantity, setBookingQuantity] = useState(1)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [bookingList, setBookingList] = useState([])
  const [bookingListLoading, setBookingListLoading] = useState(false)
  const [unitStatuses, setUnitStatuses] = useState([])
  const [unitStatusesLoading, setUnitStatusesLoading] = useState(false)

  const shouldLockScroll = Boolean(bookingProduct) || productEditorOpen

  useEffect(() => {
    const body = document?.body
    if (!body) return

    if (shouldLockScroll && !scrollLockRef.current.locked) {
      scrollLockRef.current.previousOverflow = body.style.overflow
      body.style.overflow = 'hidden'
      scrollLockRef.current.locked = true
      return
    }

    if (!shouldLockScroll && scrollLockRef.current.locked) {
      body.style.overflow = scrollLockRef.current.previousOverflow || ''
      scrollLockRef.current.previousOverflow = ''
      scrollLockRef.current.locked = false
    }

    return () => {
      // On unmount: best-effort restore.
      if (scrollLockRef.current.locked) {
        body.style.overflow = scrollLockRef.current.previousOverflow || ''
        scrollLockRef.current.previousOverflow = ''
        scrollLockRef.current.locked = false
      }
    }
  }, [shouldLockScroll])

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

  const restoreCatalog = async () => {
    setLoading(true)
    setError('')
    try {
      await apiFetch('/api/admin/catalog/restore', { token, method: 'POST' })
      await loadProducts(token)
    } catch (e) {
      setError(e.message || 'Ошибка восстановления каталога')
    } finally {
      setLoading(false)
    }
  }

  const cleanupSeedCatalog = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiFetch('/api/admin/catalog/cleanup-seed', { token, method: 'POST' })
      await loadProducts(token)
      setUiModal({
        title: 'Очистка каталога',
        message: `Скрыто seed-товаров: ${result?.deactivated ?? 0}\nАктивных товаров сейчас: ${result?.activeNow ?? '—'}`,
        primaryLabel: 'Ок',
        onPrimary: () => setUiModal(null),
      })
    } catch (e) {
      setUiModal({
        title: 'Не удалось очистить каталог',
        message: e.message || 'Ошибка очистки каталога',
        primaryLabel: 'Ок',
        onPrimary: () => setUiModal(null),
      })
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
    setError('')
    setProductEditorOpen(true)
  }

  const startEdit = (p) => {
    const resolvedImageUrls = Array.isArray(p?.imageUrls)
      ? p.imageUrls.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim())
      : typeof p?.imageUrl === 'string' && p.imageUrl.trim()
        ? [p.imageUrl.trim()]
        : []
    
    // Конвертируем equipment массив в строку для текстового поля
    const equipmentStr = Array.isArray(p?.equipment)
      ? p.equipment.join('\n')
      : typeof p?.equipment === 'string'
        ? p.equipment
        : ''
    
    // Конвертируем specs объект в строку для текстового поля
    const specsStr = p?.specs && typeof p.specs === 'object'
      ? Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join('\n')
      : typeof p?.specs === 'string'
        ? p.specs
        : ''

    setForm({
      id: p.id,
      name: p.name || '',
      category: p.category || '',
      brand: p.brand || '',
      stock: Number.isFinite(p.stock) ? p.stock : 0,
      pricePerDay: Number.isFinite(p.pricePerDay) ? p.pricePerDay : 100,
      imageUrls: resolvedImageUrls,
      description: p.description || '',
      equipment: equipmentStr,
      specs: specsStr,
      isActive: p.isActive ?? true,
    })
    setError('')
    setProductEditorOpen(true)
  }

  const closeProductEditor = () => {
    setProductEditorOpen(false)
    setForm(emptyForm)
    setError('')
  }

  const closeUiModal = () => setUiModal(null)

  const removeProduct = async (product) => {
    const id = product?.id
    if (!id) return

    const name = product?.name
    const label = String(name || '').trim() ? `«${String(name).trim()}»` : `#${id}`

    if (product?.isActive) {
      setUiModal({
        title: 'Нельзя удалить активный товар',
        message: `Товар ${label} сейчас активен и показывается на сайте.\n\nСначала снимите «Показывать на сайте», сохраните, и только потом удаляйте.`,
        primaryLabel: 'Открыть редактирование',
        onPrimary: () => {
          closeUiModal()
          startEdit(product)
        },
        secondaryLabel: 'Закрыть',
        onSecondary: closeUiModal,
      })
      return
    }

    const ok = window.confirm(`Удалить товар ${label}? Это действие нельзя отменить.`)
    if (!ok) return

    setLoading(true)
    setError('')
    try {
      await apiFetch(`/api/products/${id}`, { token, method: 'DELETE' })
      await loadProducts(token)
      if (form.id === id) setForm(emptyForm)
    } catch (e) {
      const raw = e?.message || 'Ошибка удаления'
      setError('')
      setUiModal({
        title: 'Не удалось удалить товар',
        message: raw,
        primaryLabel: 'Понятно',
        onPrimary: closeUiModal,
      })
    } finally {
      setLoading(false)
    }
  }

  const openBooking = (p) => {
    setBookingError('')
    setBookingSuccess('')
    setBookingProduct(p)
    setBookingDateFrom('')
    setBookingTimeFrom('09:00')
    setBookingDateTo('')
    setBookingTimeTo('21:00')
    setBookingQuantity(1)
    setBookingList([])
    setUnitStatuses([])
    if (p?.id) {
      loadBookings(p.id)
      loadUnitStatuses(p.id)
    }
  }

  const closeBooking = () => {
    setBookingProduct(null)
    setBookingDateFrom('')
    setBookingTimeFrom('09:00')
    setBookingDateTo('')
    setBookingTimeTo('21:00')
    setBookingQuantity(1)
    setBookingError('')
    setBookingSuccess('')
    setBookingList([])
    setBookingListLoading(false)
    setUnitStatuses([])
    setUnitStatusesLoading(false)
  }

  const getToday = () => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  const buildLocalDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null
    const value = new Date(`${dateStr}T${timeStr}:00`)
    if (Number.isNaN(value.getTime())) return null
    return value
  }

  const loadBookings = async (productId) => {
    setBookingListLoading(true)
    try {
      const data = await apiFetch(`/api/admin/bookings?productId=${encodeURIComponent(productId)}`, { token })
      const list = Array.isArray(data) ? data : []
      setBookingList(list)
      return list
    } catch (e) {
      setBookingError(e.message || 'Ошибка загрузки броней')
      setBookingList([])
      return []
    } finally {
      setBookingListLoading(false)
    }
  }

  const loadUnitStatuses = async (productId) => {
    setUnitStatusesLoading(true)
    try {
      const data = await apiFetch(`/api/admin/product-units?productId=${encodeURIComponent(productId)}`, { token })
      setUnitStatuses(Array.isArray(data) ? data : [])
    } catch (e) {
      setBookingError(e.message || 'Ошибка загрузки единиц товара')
      setUnitStatuses([])
    } finally {
      setUnitStatusesLoading(false)
    }
  }

  const removeBooking = async (bookingId) => {
    if (!bookingId) return
    setLoading(true)
    setBookingError('')
    setBookingSuccess('')

    try {
      const productId = bookingProduct?.id
      await apiFetch(`/api/admin/bookings/${bookingId}`, { token, method: 'DELETE' })
      setBookingSuccess('Бронь удалена')
      if (productId) {
        const refreshed = await loadBookings(productId)
        if (refreshed.some((b) => Number(b?.id) === Number(bookingId))) {
          throw new Error('Бронь не удалилась в БД (после обновления она всё ещё есть)')
        }
        await loadUnitStatuses(productId)
      }
      await loadProducts(token)
    } catch (e) {
      setBookingError(e.message || 'Ошибка удаления брони')
    } finally {
      setLoading(false)
    }
  }

  const submitBooking = async (e) => {
    e.preventDefault()
    if (!bookingProduct?.id) return

    setBookingError('')
    setBookingSuccess('')
    setLoading(true)

    try {
      if (!bookingDateFrom || !bookingDateTo) {
        throw new Error('Укажите даты: с какого по какое')
      }
      const start = buildLocalDateTime(bookingDateFrom, bookingTimeFrom)
      const end = buildLocalDateTime(bookingDateTo, bookingTimeTo)
      if (!start || !end) {
        throw new Error('Некорректная дата/время')
      }
      if (end.getTime() <= start.getTime()) {
        throw new Error('Окончание должно быть позже начала')
      }

      await apiFetch('/api/admin/bookings', {
        token,
        method: 'POST',
        body: {
          productId: bookingProduct.id,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          quantity: bookingQuantity,
        },
      })

      setBookingSuccess('Бронь создана')
      if (bookingProduct?.id) {
        await loadBookings(bookingProduct.id)
        await loadUnitStatuses(bookingProduct.id)
      }
      await loadProducts(token)
      // оставим модалку открытой, чтобы менеджер видел успех
    } catch (e2) {
      setBookingError(e2.message || 'Ошибка создания брони')
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

  const parseEquipment = (str) => {
    if (!str || typeof str !== 'string') return []
    return str.split('\n').map(s => s.trim()).filter(Boolean)
  }

  const parseSpecs = (str) => {
    if (!str || typeof str !== 'string') return null
    const lines = str.split('\n').map(s => s.trim()).filter(Boolean)
    if (lines.length === 0) return null
    const obj = {}
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).trim()
        if (key) obj[key] = value
      }
    }
    return Object.keys(obj).length > 0 ? obj : null
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
        // Backward-compatible: older backend versions only support imageUrl
        imageUrl: Array.isArray(form.imageUrls) && form.imageUrls[0] ? form.imageUrls[0] : null,
        imageUrls: Array.isArray(form.imageUrls) ? form.imageUrls : [],
        description: form.description.trim() || null,
        equipment: parseEquipment(form.equipment),
        specs: parseSpecs(form.specs),
        isActive: Boolean(form.isActive),
      }

      if (!payload.name) throw new Error('Название обязательно')

      if (isEditing) {
        await apiFetch(`/api/products/${form.id}`, { token, method: 'PUT', body: payload })
      } else {
        await apiFetch('/api/products', { token, method: 'POST', body: payload })
      }

      setForm(emptyForm)
      setProductEditorOpen(false)
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
                  <button className="button ghost" type="button" onClick={restoreCatalog} disabled={loading}>
                    Восстановить товары
                  </button>
                  <button className="button ghost danger" type="button" onClick={cleanupSeedCatalog} disabled={loading}>
                    Убрать лишние (54→36)
                  </button>
                  <button className="button primary" type="button" onClick={startCreate} disabled={loading}>
                    Добавить товар
                  </button>
                </div>
              </div>

              {error && <div className="error-message" style={{ marginTop: 12 }}>⚠️ {error}</div>}

              <div style={{ marginTop: 12 }}>
                <div className="catalog__grid">
                  {products.map((p) => (
                    <article
                      key={p.id}
                      className={`product product--admin ${Number(p.busyUnitsNow ?? 0) > 0 ? 'product--booked' : ''}`}
                    >
                      <div className="product__thumb">
                        <img src={getProductImage(p)} alt={p.name} loading="lazy" />
                        {Number(p.busyUnitsNow ?? 0) > 0 && (
                          <div className="product__booked-badge">
                            {p.nextAvailableAt
                              ? `Бронь до ${formatDateTimeRu(p.nextAvailableAt)}`
                              : 'Забронировано'}
                          </div>
                        )}
                      </div>
                      <div className="product__meta">
                        <span className="badge">{formatBrand(p.brand)}</span>
                        <span className="badge badge--ghost">{p.category || 'Без категории'}</span>
                        <span className="badge badge--ghost">Склад: {p.stock ?? 0}</span>
                        <span className="badge badge--ghost">{p.isActive ? 'Активен' : 'Скрыт'}</span>
                        {Number(p.stock ?? 0) > 0 && (
                          <span className="badge badge--ghost">
                            Свободно сейчас: {Math.max(0, Number(p.availableNow ?? 0))} / {Math.max(0, Number(p.totalUnits ?? p.stock ?? 0))}
                          </span>
                        )}
                        {Number(p.busyUnitsNow ?? 0) > 0 && p.nextAvailableAt && (
                          <span className="badge badge--ghost">Ближайшая бронь до {formatDateTimeRu(p.nextAvailableAt)}</span>
                        )}
                      </div>
                      <h3>{p.name}</h3>
                      <p className="product__price">{p.pricePerDay ?? 100} сом/сутки</p>
                      <div className="product__actions product__actions--admin">
                        <button className="button ghost" type="button" onClick={() => startEdit(p)} disabled={loading}>
                          Редактировать
                        </button>
                        <button className="button ghost danger" type="button" onClick={() => removeProduct(p)} disabled={loading}>
                          Удалить
                        </button>
                        <button className="button primary" type="button" onClick={() => openBooking(p)} disabled={loading}>
                          Бронь
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {!loading && products.length === 0 && (
                  <div style={{ padding: 12, opacity: 0.8 }}>Товаров пока нет</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {productEditorOpen && (
        <div className="modal-overlay" onClick={closeProductEditor}>
          <div className="modal-card modal-card--admin modal-card--product-editor" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={closeProductEditor} aria-label="Закрыть" type="button">
              ×
            </button>

            <form onSubmit={saveProduct} className="checkout-page__form product-editor">
              <div className="product-editor__layout">
                <div className="product-editor__fields">
                  <h3>{isEditing ? 'Редактирование товара' : 'Новый товар'}</h3>

                  {error && <div className="error-message">⚠️ {error}</div>}

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
                    <label>Ссылки на картинки (несколько — через перенос строки или запятую)</label>
                    <textarea
                      value={(form.imageUrls || []).join('\n')}
                      onChange={(e) => setForm((prev) => ({ ...prev, imageUrls: normalizeImageUrls(e.target.value) }))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Загрузить картинку</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length === 0) return
                        try {
                          setLoading(true)
                          const uploaded = []
                          for (const file of files) {
                            const url = await uploadImage(file)
                            if (url) uploaded.push(url)
                          }
                          if (uploaded.length) {
                            setForm((prev) => ({
                              ...prev,
                              imageUrls: Array.from(new Set([...(prev.imageUrls || []), ...uploaded])).slice(0, 12),
                            }))
                          }
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
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Подробное описание товара..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Комплектация (каждый пункт с новой строки)</label>
                    <textarea
                      value={form.equipment}
                      onChange={(e) => setForm((prev) => ({ ...prev, equipment: e.target.value }))}
                      rows={4}
                      placeholder="Основной блок&#10;Кабель питания&#10;Сумка для переноски&#10;Инструкция"
                    />
                  </div>

                  <div className="form-group">
                    <label>Характеристики (Название: значение, каждая с новой строки)</label>
                    <textarea
                      value={form.specs}
                      onChange={(e) => setForm((prev) => ({ ...prev, specs: e.target.value }))}
                      rows={4}
                      placeholder="Мощность: 600 Вт&#10;Цветовая температура: 2700K - 6500K&#10;CRI: 95+&#10;Вес: 3.2 кг"
                    />
                  </div>

                  <div className="form-group">
                    <div className="toggle-row">
                      <div className="toggle-row__label">Показывать на сайте</div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(form.isActive)}
                          onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        />
                        <span className="toggle__track" aria-hidden="true">
                          <span className="toggle__thumb" />
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="checkout-page__actions">
                    <button className="button ghost" type="button" onClick={closeProductEditor} disabled={loading}>
                      Отмена
                    </button>
                    <button className="button ghost" type="button" onClick={() => setForm(emptyForm)} disabled={loading}>
                      Очистить
                    </button>
                    <button className="button primary" type="submit" disabled={loading}>
                      {loading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>

                <div className="product-editor__media">
                  <p className="eyebrow" style={{ marginBottom: 8 }}>Фото</p>
                  <div className="product-editor__preview">
                    {editorImages.length > 0 ? (
                      <>
                        <img
                          src={resolveAdminImageUrl(editorImages[Math.min(editorImageIndex, editorImages.length - 1)]) || getProductImage(form)}
                          alt={form.name || 'Фото товара'}
                          loading="lazy"
                        />

                        <button
                          type="button"
                          className="product-editor__remove"
                          onClick={() => removeEditorImageAt(Math.min(editorImageIndex, editorImages.length - 1))}
                          aria-label="Удалить текущее фото"
                          title="Удалить фото"
                          disabled={loading}
                        >
                          ×
                        </button>

                        {editorImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              className="product-editor__nav product-editor__nav--prev"
                              onClick={() => setEditorImageIndex((prev) => (prev - 1 + editorImages.length) % editorImages.length)}
                              aria-label="Предыдущее фото"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="product-editor__nav product-editor__nav--next"
                              onClick={() => setEditorImageIndex((prev) => (prev + 1) % editorImages.length)}
                              aria-label="Следующее фото"
                            >
                              ›
                            </button>
                            <div className="product-editor__counter">{Math.min(editorImageIndex + 1, editorImages.length)} / {editorImages.length}</div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="product-editor__empty">
                        Добавьте ссылки или загрузите фото
                      </div>
                    )}
                  </div>

                  {editorImages.length > 0 && (
                    <div className="product-editor__thumbs" role="tablist" aria-label="Миниатюры">
                      {editorImages.map((u, idx) => {
                        const active = idx === editorImageIndex
                        return (
                          <div className="product-editor__thumb-item" key={`${u}-${idx}`}>
                            <button
                              type="button"
                              className={`product-editor__thumb ${active ? 'is-active' : ''}`}
                              onClick={() => setEditorImageIndex(idx)}
                              aria-label={`Фото ${idx + 1}`}
                              aria-current={active ? 'true' : 'false'}
                            >
                              <img src={resolveAdminImageUrl(u)} alt="" loading="lazy" />
                            </button>
                            <button
                              type="button"
                              className="product-editor__thumb-remove"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                removeEditorImageAt(idx)
                              }}
                              aria-label={`Удалить фото ${idx + 1}`}
                              title="Удалить"
                              disabled={loading}
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {bookingProduct && (
        <div className="modal-overlay" onClick={closeBooking}>
          <div className="modal-card modal-card--admin" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={closeBooking} aria-label="Закрыть" type="button">
              ×
            </button>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <p className="eyebrow">Бронь</p>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{bookingProduct.name}</h2>
              </div>

              <form onSubmit={submitBooking} className="checkout-page__form">
                <div className="form-group">
                  <label>Количество (шт.)</label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Number(bookingProduct?.totalUnits ?? bookingProduct?.stock ?? 1))}
                    value={bookingQuantity}
                    onChange={(e) => setBookingQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>С какого (дата)</label>
                  <input
                    type="date"
                    value={bookingDateFrom}
                    min={getToday()}
                    onChange={(e) => {
                      const next = e.target.value
                      setBookingDateFrom(next)
                      if (bookingDateTo && next && bookingDateTo < next) {
                        setBookingDateTo(next)
                      }
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Время начала</label>
                  <input type="time" value={bookingTimeFrom} onChange={(e) => setBookingTimeFrom(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label>По какое (дата)</label>
                  <input
                    type="date"
                    value={bookingDateTo}
                    min={bookingDateFrom || getToday()}
                    onChange={(e) => setBookingDateTo(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Время окончания</label>
                  <input type="time" value={bookingTimeTo} onChange={(e) => setBookingTimeTo(e.target.value)} required />
                </div>

                {bookingError && <div className="error-message">⚠️ {bookingError}</div>}
                {bookingSuccess && <div className="error-message" style={{ borderColor: 'rgba(0, 200, 120, 0.35)', background: 'rgba(0, 200, 120, 0.08)' }}>✓ {bookingSuccess}</div>}

                <div className="checkout-page__actions">
                  <button className="button ghost" type="button" onClick={closeBooking} disabled={loading}>
                    Отмена
                  </button>
                  <button className="button primary" type="submit" disabled={loading}>
                    {loading ? 'Сохранение...' : 'Забронировать'}
                  </button>
                </div>
              </form>

              <div className="cart-page" style={{ padding: 12 }}>
                <strong>Единицы товара</strong>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {unitStatusesLoading && <div style={{ opacity: 0.8 }}>Загрузка...</div>}
                  {!unitStatusesLoading && unitStatuses.length === 0 && <div style={{ opacity: 0.8 }}>Нет единиц (проверь stock)</div>}
                  {!unitStatusesLoading && unitStatuses.map((u) => (
                    <div key={u.unitId} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'grid', gap: 2 }}>
                        <div style={{ fontWeight: 600 }}>Штука #{u.unitNo}</div>
                        <div style={{ opacity: 0.9 }}>
                          {u.busyUntil ? `Занято до ${formatDateTimeRu(u.busyUntil)}` : 'Свободно'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cart-page" style={{ padding: 12 }}>
                <strong>Текущие брони</strong>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {bookingListLoading && <div style={{ opacity: 0.8 }}>Загрузка...</div>}
                  {!bookingListLoading && bookingList.length === 0 && <div style={{ opacity: 0.8 }}>Броней нет</div>}
                  {!bookingListLoading && bookingList.map((b) => (
                    <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'grid', gap: 2 }}>
                        <div style={{ fontWeight: 600 }}>#{b.id}{b.unitNo ? ` · штука #${b.unitNo}` : ''}</div>
                        <div style={{ opacity: 0.9 }}>{formatDateTimeRu(b.startAt)} — {formatDateTimeRu(b.endAt)}</div>
                      </div>
                      <button className="button ghost danger" type="button" onClick={() => removeBooking(b.id)} disabled={loading}>
                        Убрать бронь
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {uiModal && (
        <div className="modal-overlay" onClick={closeUiModal}>
          <div
            className="modal-card modal-card--admin modal-card--alert"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className="modal-close" onClick={closeUiModal} aria-label="Закрыть" type="button">
              ×
            </button>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <p className="eyebrow">Внимание</p>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{uiModal.title || 'Сообщение'}</h2>
              </div>
              <div className="cart-page" style={{ padding: 14, whiteSpace: 'pre-wrap' }}>
                {uiModal.message || ''}
              </div>
              <div className="checkout-page__actions">
                {uiModal.secondaryLabel && (
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => (typeof uiModal.onSecondary === 'function' ? uiModal.onSecondary() : closeUiModal())}
                    disabled={loading}
                  >
                    {uiModal.secondaryLabel}
                  </button>
                )}
                <button
                  className="button primary"
                  type="button"
                  onClick={() => (typeof uiModal.onPrimary === 'function' ? uiModal.onPrimary() : closeUiModal())}
                  disabled={loading}
                >
                  {uiModal.primaryLabel || 'Ок'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
