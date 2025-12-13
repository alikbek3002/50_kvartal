import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import inventory from './data/inventory.json'
import { plural } from './utils/helpers'
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

function App() {
  const navigate = useNavigate()
  const [selectedItem, setSelectedItem] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [dateTimePickerState, setDateTimePickerState] = useState({ isOpen: false, item: null, mode: null })
  const [editingCartItem, setEditingCartItem] = useState(null)
  const [toastState, setToastState] = useState({ isVisible: false, message: '' })

  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      try {
        const response = await fetch(`${API_URL}/api/products`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (isMounted && Array.isArray(data)) {
          setProducts(data)
        }
      } catch (error) {
        console.error('Failed to load products from API:', error)
      } finally {
        if (isMounted) setProductsLoading(false)
      }
    }

    loadProducts()
    return () => {
      isMounted = false
    }
  }, [])

  const catalogItems = useMemo(() => {
    if (!productsLoading && products.length > 0) return products
    return inventory
  }, [products, productsLoading])

  const categoryTotals = useMemo(() => {
    return catalogItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {})
  }, [catalogItems])

  const heroStats = useMemo(() => {
    const categoriesCount = Object.keys(categoryTotals).length
    return [
      { value: catalogItems.length, label: plural(catalogItems.length, ['позиция', 'позиции', 'позиций']) },
      { value: categoriesCount, label: plural(categoriesCount, ['категория', 'категории', 'категорий']) },
    ]
  }, [categoryTotals, catalogItems.length])

  const categoryChips = useMemo(() => Object.entries(categoryTotals).sort(([, a], [, b]) => b - a), [categoryTotals])

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.count, 0)

  const addToCart = (item, rentalPeriod) => {
    setCartItems((prev) => {
      return [...prev, { item, count: 1, rentalPeriod }]
    })
  }

  const showToast = (message) => {
    setToastState({ isVisible: true, message })
  }

  const hideToast = () => {
    setToastState({ isVisible: false, message: '' })
  }

  const openDateTimePicker = (item, mode) => {
    setDateTimePickerState({ isOpen: true, item, mode })
  }

  const closeDateTimePicker = () => {
    setDateTimePickerState({ isOpen: false, item: null, mode: null })
  }

  const handleDateTimeSubmit = (rentalPeriod) => {
    const { item, mode } = dateTimePickerState
    
    if (mode === 'edit') {
      // Редактирование даты товара в корзине
      setCartItems((prev) =>
        prev.map((entry) =>
          entry.item.name === editingCartItem ? { ...entry, rentalPeriod } : entry
        )
      )
      showToast('Даты аренды обновлены')
      setEditingCartItem(null)
      closeDateTimePicker()
    } else if (mode === 'cart') {
      addToCart(item, rentalPeriod)
      showToast('Товар добавлен в корзину')
      closeDateTimePicker()
      closeModal()
    } else if (mode === 'quick') {
      addToCart(item, rentalPeriod)
      closeDateTimePicker()
      closeModal()
      navigate('/checkout')
    }
  }

  const handleEditCartItemDate = (itemName) => {
    const cartItem = cartItems.find((entry) => entry.item.name === itemName)
    if (cartItem) {
      setEditingCartItem(itemName)
      setDateTimePickerState({ isOpen: true, item: cartItem.item, mode: 'edit', existingPeriod: cartItem.rentalPeriod })
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
