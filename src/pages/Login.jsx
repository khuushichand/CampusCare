import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

const Login = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (role === 'student') {
      navigate('/student/dashboard');
    } else {
      // Future admin route
      navigate('/admin/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side branding */}
      <div className="hidden lg:flex flex-col w-1/2 bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
             <div className="w-10 h-10 bg-blue-500 rounded-md flex items-center justify-center">
              <span className="text-white text-xl">🏛️</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">CampusCare</h1>
          <p className="text-xl text-slate-300 max-w-md">
            Intelligent Campus Maintenance & Issue Prediction System
          </p>
        </div>
        
        {/* Abstract background graphics */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
          <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        </div>

        <div className="mt-auto relative z-10 flex gap-6 text-sm text-slate-400 font-medium">
          <span>Report • Resolve • Maintain</span>
          <span>A Smarter Campus Together</span>
        </div>
      </div>

      {/* Right side form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Log in to continue to CampusCare</p>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
            <button
              onClick={() => setRole('student')}
              className={clsx(
                'flex-1 py-2.5 text-sm font-medium rounded-lg transition-all',
                role === 'student' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Student
            </button>
            <button
              onClick={() => setRole('admin')}
              className={clsx(
                'flex-1 py-2.5 text-sm font-medium rounded-lg transition-all',
                role === 'admin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Email / USN"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            <div>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Password"
                  className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                <span className="text-slate-600">Remember me</span>
              </label>
              <a href="#" className="text-blue-600 font-medium hover:text-blue-700">Forgot password?</a>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm mt-2"
            >
              Login
            </button>
          </form>
          
          <p className="text-center text-sm text-slate-500 mt-8">
            Don't have an account? <a href="#" className="text-blue-600 font-medium hover:text-blue-700">Contact Admin</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
