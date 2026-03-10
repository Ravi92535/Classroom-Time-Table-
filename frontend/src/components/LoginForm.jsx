import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';

export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useStore();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = login(email, password);
    if (result.success) {
      if (result.role === 'admin')        navigate('/admin');
      else if (result.role === 'teacher') navigate('/teacher');
      else                                navigate('/student');
    } else {
      setError(result.error || 'Login failed.');
    }
    setIsLoading(false);
  };

  const fillCredentials = (role) => {
    const emails = { admin: 'admin@gmail.com', teacher: 'teacher@gmail.com', student: 'student@gmail.com' };
    setEmail(emails[role]);
    setPassword('1234');
    setError('');
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-1 text-gray-500 text-sm">Sign in to access your dashboard</p>
        </div>

        {/* Quick-fill buttons */}
        <div>
          <p className="text-xs text-gray-400 mb-2 text-center font-medium tracking-wide uppercase">Quick Fill</p>
          <div className="flex gap-2">
            {['admin', 'teacher', 'student'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => fillCredentials(role)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg capitalize border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 active:bg-indigo-100 transition-all"
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="e.g. admin@gmail.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter password"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-3">No account needed</p>
          <button
            type="button"
            onClick={() => navigate('/timetable')}
            className="w-full py-2.5 px-4 bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-700 font-medium rounded-lg border border-green-200 transition text-sm"
          >
            📅 View Public Timetable
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center leading-relaxed">
          Demo password: <strong className="font-mono">1234</strong><br />
          admin@gmail.com · teacher@gmail.com · student@gmail.com
        </p>
      </div>
    </div>
  );
}
