import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SettingsPage } from './components/Settings/SettingsPage'
import { AuthProvider } from './context/AuthContext'

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/u/:username" element={<App />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
