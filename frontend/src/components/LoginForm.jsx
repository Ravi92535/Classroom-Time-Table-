import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useStore } from '../lib/store.jsx';

export default function LoginForm() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useStore();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsLoading(true);
    setError('');
    try {
      // Pass the access_token to backend; backend calls Google's userinfo endpoint
      const result = await loginWithGoogle(tokenResponse.access_token);
      if (result.success) {
        if (result.role === 'admin') navigate('/admin');
        else if (result.role === 'teacher') navigate('/teacher');
        else navigate('/student');
      } else {
        setError(result.error || 'Login failed.');
      }
    } catch (err) {
      setError('Failed to sign in. Please try again.');
    }
    setIsLoading(false);
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      setError('Google sign-in was cancelled or failed. Please try again.');
      setIsLoading(false);
    },
  });

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-1 text-gray-500 text-sm">Sign in with your Google account to continue</p>
        </div>

        {/* Role info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Access Levels</p>
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <span className="w-5 h-5 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold shrink-0">A</span>
            <span>Admin — assigned by system</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold shrink-0">T</span>
            <span>Teacher — Gmail added by admin</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <span className="w-5 h-5 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold shrink-0">S</span>
            <span>Student — any other Google account</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            ⚠️ {error}
          </p>
        )}

        {/* Google Sign-In button */}
        <button
          onClick={() => { setError(''); setIsLoading(true); googleLogin(); }}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 border-2 border-gray-200 hover:border-indigo-300 text-gray-700 font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        {/* Public timetable */}
        <div className="pt-1 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate('/timetable')}
            className="w-full py-2.5 px-4 bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-700 font-medium rounded-xl border border-green-200 transition text-sm"
          >
            📅 View Public Timetable (no login required)
          </button>
        </div>
      </div>
    </div>
  );
}
