function normalizeApiUrl(raw) {
	const value = String(raw || '').trim()
	if (!value) return ''

	// Already has protocol
	if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '')

	// Common deploy mistake: domain without protocol.
	// Use http for localhost/dev, otherwise https.
	const isLocal =
		/^localhost(?::\d+)?$/i.test(value) ||
		/^127\.\d+\.\d+\.\d+(?::\d+)?$/.test(value)
	const protocol = isLocal ? 'http://' : 'https://'
	return `${protocol}${value}`.replace(/\/+$/, '')
}

// Set in hosting as VITE_API_URL=https://<your-backend>.up.railway.app
export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL)
