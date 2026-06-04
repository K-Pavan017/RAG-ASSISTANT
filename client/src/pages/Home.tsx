import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
      <div className="flex flex-col items-center space-y-6 rounded-2xl bg-white p-12 shadow-xl">
        <h1 className="text-4xl font-bold text-slate-800">Welcome to the AI Knowledge Assistant</h1>
        <p className="text-center text-slate-600 max-w-sm">
          Please sign in if you already have an account, or create a new one to start using the platform.
        </p>
        <div className="flex space-x-4">
          <Link
            to="/login"
            className="rounded-lg bg-primary-600 px-6 py-3 text-white hover:bg-primary-700"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-primary-500 px-6 py-3 text-white hover:bg-primary-600"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
