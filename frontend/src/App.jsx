import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './lib/store.jsx';
import HomePage from './pages/HomePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import TeacherPage from './pages/TeacherPage.jsx';
import StudentPage from './pages/StudentPage.jsx';
import TimetablePage from './pages/TimetablePage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/admin"     element={<AdminPage />} />
          <Route path="/teacher"   element={<TeacherPage />} />
          <Route path="/student"   element={<StudentPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          {/* Catch-all: redirect unknown routes to home */}
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}
