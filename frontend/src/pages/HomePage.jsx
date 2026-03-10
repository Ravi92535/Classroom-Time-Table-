import LoginForm from '../components/LoginForm.jsx';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="mb-6 sm:mb-8 text-center px-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">
          Room Allocation System
        </h1>
        <p className="mt-2 text-gray-500 text-sm">Manage classrooms, timetables and branches</p>
      </div>
      <LoginForm />
    </div>
  );
}
