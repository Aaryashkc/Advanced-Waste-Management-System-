import React, { useEffect } from 'react'
import AppRoutes from './routes/AppRoutes'
import useAuthStore from './stores/useAuthStore'

const App = () => {
  const { hydrateFromStorage, fetchMe, token } = useAuthStore();

  useEffect(() => {
    // Hydrate auth state from localStorage on app load
    hydrateFromStorage();
    
    // If token exists, fetch current user to verify token and get latest user data
    if (token) {
      fetchMe().catch(() => {
        // If fetchMe fails, token is likely invalid - will be cleared by interceptor
        console.log('Failed to fetch user, token may be invalid');
      });
    }
  }, []); // Only run on mount

  return (
    <div>
      <AppRoutes/>
    </div>
  )
}

export default App