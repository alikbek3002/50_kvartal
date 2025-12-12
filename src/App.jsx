import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import inventory from './data/inventory.json'
import { plural } from './utils/helpers'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { ProductModal } from './components/ProductModal'
import { CartDrawer } from './components/CartDrawer'
import { DateTimePicker } from './components/DateTimePicker'
import { Toast } from './components/Toast'
import { HomePage } from './pages/HomePage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'

function App() {
  const navigate = useNavigate()
  const [selectedItem, setSelectedItem] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [dateTimePickerState, setDateTimePickerState] = useState({ isOpen: false, item: null, mode: null })
  const [toastState, setToastState] = useState({ isVisible: false, message: '' })

  const categoryTotals = useMemo(() => {
    return inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {})
  }, [])

  const heroStats = useMemo(() => {
    const categoriesCount = Object.keys(categoryTotals).length
    return [
      { value: inventory.length, label: plural(inventory.length, ['позиция', 'позиции', 'позиций']) },
      { value: categoriesCount, label: plural(categoriesCount, ['категория', 'категории', 'категорий']) },
    ]
  }, [categoryTotals])

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
    
    if (mode === 'cart') {
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
  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        if (selectedItem) {
          closeModal()
        } else if (isCartOpen) {
          closeCart()
        }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selectedItem, isCartOpen])

  // Блокировка скролла при открытых модальных окнах
  useEffect(() => {
    if (selectedItem || isCartOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedItem, isCartOpen])

  return (
    <div className="page">
      <Header cartCount={cartCount} onCartOpen={openCart} />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              heroStats={heroStats}
              items={inventory}
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
              items={inventory}
              onSelectItem={setSelectedItem}
              onAddToCart={(item) => openDateTimePicker(item, 'cart')}
              onQuickRent={(item) => openDateTimePicker(item, 'quick')}
              categoryChips={categoryChips}
              cartItems={cartItems}
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
      <CartDrawer
        isOpen={isCartOpen}
        items={cartItems}
        onClose={closeCart}
        onIncrement={incrementCart}
        onDecrement={decrementCart}
        onRemove={removeFromCart}
        onCheckout={() => {
          closeCart()
          navigate('/checkout')
        }}
      />
      <DateTimePicker
        isOpen={dateTimePickerState.isOpen}
        item={dateTimePickerState.item}
        mode={dateTimePickerState.mode}
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
