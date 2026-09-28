import React from 'react';
import { user } from '../../data/mockData';
import { User, Mail, Hash, BookOpen, Shield } from 'lucide-react';

const Profile = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Profile Settings</h1>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Cover */}
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
          <div className="absolute -bottom-12 left-8 w-24 h-24 bg-white rounded-full p-1 shadow-sm">
            <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
              {user.name.charAt(0)}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="pt-16 p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
              <p className="text-slate-500 capitalize">{user.role}</p>
            </div>
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
              Edit Profile
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">USN (University Seat Number)</p>
                <p className="font-semibold text-slate-900">1RV20CS054</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Email Address</p>
                <p className="font-semibold text-slate-900">khuushi.cs20@university.edu</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Department</p>
                <p className="font-semibold text-slate-900">Computer Science & Engineering</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Account Role</p>
                <p className="font-semibold text-slate-900 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
