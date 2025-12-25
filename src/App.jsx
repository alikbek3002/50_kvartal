import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { plural, formatBookedUntil } from './utils/helpers'
import { API_URL } from './config'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { ProductModal } from './components/ProductModal'
import { DateTimePicker } from './components/DateTimePicker'
import { Toast } from './components/Toast'
import { HomePage } from './pages/HomePage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { CartPage } from './pages/CartPage'
import { MAIN_CATEGORIES, getEffectiveMainCategory } from './utils/categories'

function App() {
  const navigate = useNavigate()
  const [selectedItem, setSelectedItem] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [dateTimePickerState, setDateTimePickerState] = useState({ isOpen: false, item: null, mode: null })
  const [editingCartItem, setEditingCartItem] = useState(null)
  const [toastState, setToastState] = useState({ isVisible: false, message: '' })

  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [maintenance, setMaintenance] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/api/products`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const contentType = response.headers.get('content-type') || ''
        // On hosting, a common misconfig is VITE_API_URL pointing to the frontend.
        // Then /api/products returns index.html (200 OK) and JSON parsing fails.
        if (!contentType.includes('application/json')) {
          const text = await response.text().catch(() => '')
          const preview = String(text).slice(0, 120).replace(/\s+/g, ' ').trim()
          const hint = preview.toLowerCase().includes('<!doctype html') || preview.toLowerCase().includes('<html')
            ? 'Похоже, API_URL указывает на фронтенд (вернулся HTML), а не на бэкенд.'
            : 'Бэкенд вернул не-JSON ответ.'
          throw new Error(`${hint} Проверь VITE_API_URL на хостинге.`)
        }

        const data = await response.json()
        if (!isMounted) return
        setProducts(Array.isArray(data) ? data : [])
        setMaintenance(false)
      } catch (error) {
        console.error('Failed to load products from API:', error)
        if (isMounted) {
          setProducts([])
          setMaintenance(true)
        }
      } finally {
        if (isMounted) setProductsLoading(false)
      }
    }

    loadProducts()

    const handleFocus = () => {
      loadProducts()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadProducts()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      isMounted = false
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const catalogItems = useMemo(() => {
    if (productsLoading) return []
    return products
  }, [products, productsLoading])

  const categoryTotals = useMemo(() => {
    const totals = MAIN_CATEGORIES.reduce((acc, category) => {
      acc[category] = 0
      return acc
    }, {})

    for (const item of catalogItems) {
      const category = getEffectiveMainCategory(item)
      if (!category) continue
      totals[category] = (totals[category] || 0) + 1
    }

    return totals
  }, [catalogItems])

  const heroStats = useMemo(() => {
    const categoriesCount = Object.keys(categoryTotals).length
    return [
      { value: catalogItems.length, label: plural(catalogItems.length, ['позиция', 'позиции', 'позиций']) },
      { value: categoriesCount, label: plural(categoriesCount, ['категория', 'категории', 'категорий']) },
    ]
  }, [categoryTotals, catalogItems.length])

  const categoryChips = useMemo(() => {
    return MAIN_CATEGORIES
      .map((category) => [category, categoryTotals?.[category] || 0])
      .filter(([, count]) => count > 0)
  }, [categoryTotals])

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.count, 0)

  const addToCart = (item, rentalPeriod, count = 1) => {
    const resolvedCount = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : 1
    setCartItems((prev) => {
      return [...prev, { item, count: resolvedCount, rentalPeriod }]
    })
  }

  const showToast = (message) => {
    setToastState({ isVisible: true, message })
  }

  const hideToast = () => {
    setToastState({ isVisible: false, message: '' })
  }

  const openDateTimePicker = (item, mode) => {
    const stock = Number.isFinite(Number(item?.stock)) ? Number(item.stock) : 0
    const hasAvailabilityV2 =
      item &&
      (Object.prototype.hasOwnProperty.call(item, 'availableNow') ||
        Object.prototype.hasOwnProperty.call(item, 'busyUnitsNow') ||
        Object.prototype.hasOwnProperty.call(item, 'nextAvailableAt'))
    const availableNow = Number.isFinite(Number(item?.availableNow)) ? Number(item.availableNow) : stock
    const nextAvailableAt = item?.nextAvailableAt

    if (stock <= 0) {
      showToast('Нет в наличии')
      return
    }

    if (!hasAvailabilityV2) {
      const bookedUntil = item?.bookedUntil
      if (bookedUntil && new Date(bookedUntil).getTime() > Date.now()) {
        showToast(`Сейчас занято. Освободится: ${formatBookedUntil(bookedUntil)}`)
        return
      }
    }

    if (availableNow <= 0 && nextAvailableAt) {
      showToast(`Сейчас занято. Ближайшее освобождение: ${formatBookedUntil(nextAvailableAt)}`)
    }

    setDateTimePickerState({ isOpen: true, item, mode })
  }

  const closeDateTimePicker = () => {
    setDateTimePickerState({ isOpen: false, item: null, mode: null })
  }

  const handleDateTimeSubmit = (rentalPeriod) => {
    const { item, mode } = dateTimePickerState
    const qty = Number.isFinite(Number(rentalPeriod?.quantity)) ? Math.max(1, Math.floor(Number(rentalPeriod.quantity))) : 1
    
    if (mode === 'edit') {
      // Редактирование даты товара в корзине
      setCartItems((prev) =>
        prev.map((entry) =>
          entry.item.name === editingCartItem ? { ...entry, rentalPeriod, count: qty } : entry
        )
      )
      showToast('Даты аренды обновлены')
      setEditingCartItem(null)
      closeDateTimePicker()
    } else if (mode === 'cart') {
      addToCart(item, rentalPeriod, qty)
      showToast('Товар добавлен в корзину')
      closeDateTimePicker()
      closeModal()
    } else if (mode === 'quick') {
      addToCart(item, rentalPeriod, qty)
      closeDateTimePicker()
      closeModal()
      navigate('/checkout')
    }
  }

  const handleEditCartItemDate = (itemName) => {
    const cartItem = cartItems.find((entry) => entry.item.name === itemName)
    if (cartItem) {
      setEditingCartItem(itemName)
      setDateTimePickerState({
        isOpen: true,
        item: cartItem.item,
        mode: 'edit',
        existingPeriod: { ...cartItem.rentalPeriod, quantity: cartItem.count },
      })
    }
  }

  const incrementCart = (name) => {
    setCartItems((prev) => prev.map((entry) => (entry.item.name === name ? { ...entry, count: entry.count + 1 } : entry)))
  }

  const decrementCart = (name) => {
    setCartItems((prev) =>
      prev
        .map((entry) => (entry.item.name === name ? { ...entry, count: entry.count - 1 } : entry))
        .filter((entry) => entry.count > 0),
    )
  }

  const removeFromCart = (name) => {
    setCartItems((prev) => prev.filter((entry) => entry.item.name !== name))
  }

  const clearCart = () => {
    setCartItems([])
  }

  const closeModal = () => setSelectedItem(null)
  const openCart = () => navigate('/cart')

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        if (selectedItem) {
          closeModal()
        }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selectedItem])

  if (maintenance) {
    return (
      <div className="page">
        <Header cartCount={cartCount} onCartOpen={openCart} />
        <main className="page-content">
          <div className="container" style={{ maxWidth: 720 }}>
            <h1>Ведутся технические работы</h1>
            <p className="lead">Каталог временно недоступен. Пожалуйста, попробуйте позже.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="page">
      <Header cartCount={cartCount} onCartOpen={openCart} />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              heroStats={heroStats}
              items={catalogItems}
              onSelectItem={setSelectedItem}
              onAddToCart={(item) => openDateTimePicker(item, 'cart')}
              onQuickRent={(item) => openDateTimePicker(item, 'quick')}
              cartItems={cartItems}
            />
          }
        />
        <Route
          path="/catalog"
          element={
            <CatalogPage
              items={catalogItems}
              onSelectItem={setSelectedItem}
              onAddToCart={(item) => openDateTimePicker(item, 'cart')}
              onQuickRent={(item) => openDateTimePicker(item, 'quick')}
              categoryChips={categoryChips}
              cartItems={cartItems}
            />
          }
        />
        <Route
          path="/cart"
          element={
            <CartPage
              items={cartItems}
              onRemove={removeFromCart}
              onEditDate={handleEditCartItemDate}
              onClearCart={clearCart}
            />
          }
        />
        <Route
          path="/checkout"
          element={
            <CheckoutPage
              items={cartItems}
              onRemove={removeFromCart}
              onClearCart={clearCart}
            />
          }
        />
      </Routes>
      <Footer />
      <ProductModal
        item={selectedItem}
        onClose={closeModal}
        onAddToCart={(item) => openDateTimePicker(item, 'cart')}
        onQuickRent={(item) => openDateTimePicker(item, 'quick')}
      />
      <DateTimePicker
        isOpen={dateTimePickerState.isOpen}
        item={dateTimePickerState.item}
        mode={dateTimePickerState.mode}
        existingPeriod={dateTimePickerState.existingPeriod}
        onClose={closeDateTimePicker}
        onSubmit={handleDateTimeSubmit}
      />
      <Toast
        message={toastState.message}
        isVisible={toastState.isVisible}
        onClose={hideToast}
      />
    </div>
  )
}

export default App
