import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { GalleryProvider } from './context/GalleryContext';
import Navbar from './components/Navbar/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import BookmarksPage from './pages/BookmarksPage';
import LikedPage from './pages/LikedPage';
import ContactPage from './pages/ContactPage';
import HelpPage from './pages/HelpPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GalleryProvider>
          <div className="app">
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route
                path="/likes"
                element={
                  <ProtectedRoute>
                    <LikedPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bookmarks"
                element={
                  <ProtectedRoute>
                    <BookmarksPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#111',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                padding: '12px 20px',
              },
              success: { iconTheme: { primary: '#fff', secondary: '#111' } },
              error: { iconTheme: { primary: '#fff', secondary: '#111' } },
            }}
          />
        </GalleryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
