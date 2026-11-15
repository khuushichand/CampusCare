import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Hash,
  BookOpen,
  Shield,
  Pencil,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { user } from '../../data/mockData';

const getStoredUser = () => {
  try {
    const savedUserRaw = localStorage.getItem('campuscare_user');
    return savedUserRaw ? JSON.parse(savedUserRaw) : user;
  } catch (error) {
    console.error('Could not read the saved profile:', error);
    return user;
  }
};

const Profile = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || user.name || '',
    email: currentUser?.email || 'khuushi.cs20@university.edu',
    department: currentUser?.department || 'Computer Science & Engineering',
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const syncProfile = () => {
      const latestUser = getStoredUser();
      setCurrentUser(latestUser);
      setFormData({
        name: latestUser?.name || user.name || '',
        email: latestUser?.email || 'khuushi.cs20@university.edu',
        department: latestUser?.department || 'Computer Science & Engineering',
      });
    };

    window.addEventListener('storage', syncProfile);
    return () => window.removeEventListener('storage', syncProfile);
  }, []);

  const userName = currentUser?.name || user.name || 'Student';
  const userRole = currentUser?.role || user.role || 'student';
  const userUsn = currentUser?.usn || currentUser?.student_id || '1RV20CS054';
  const userEmail = currentUser?.email || 'khuushi.cs20@university.edu';
  const department = currentUser?.department || 'Computer Science & Engineering';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setSaveMessage('');
    setSaveError('');
  };

  const handleEdit = () => {
    setFormData({
      name: userName,
      email: userEmail,
      department,
    });
    setSaveMessage('');
    setSaveError('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData({
      name: userName,
      email: userEmail,
      department,
    });
    setIsEditing(false);
    setSaveError('');
  };

  const handleSave = (event) => {
    event.preventDefault();

    const name = formData.name.trim();
    const email = formData.email.trim();
    const updatedDepartment = formData.department.trim();

    if (!name || !email || !updatedDepartment) {
      setSaveError('Please fill in all profile fields.');
      setSaveMessage('');
      return;
    }

    const updatedUser = {
      ...currentUser,
      name,
      email,
      department: updatedDepartment,
    };

    try {
      localStorage.setItem('campuscare_user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setFormData({ name, email, department: updatedDepartment });
      setIsEditing(false);
      setSaveError('');
      setSaveMessage('Your profile has been updated.');
      window.dispatchEvent(new Event('campuscare-profile-updated'));
    } catch (error) {
      console.error('Could not save the profile:', error);
      setSaveError('Your changes could not be saved. Please try again.');
      setSaveMessage('');
    }
  };

  const inputClassName =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Profile Settings</h1>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Cover */}
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
          <div className="absolute -bottom-12 left-8 w-24 h-24 bg-white rounded-full p-1 shadow-sm">
            <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="pt-16 p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{userName}</h2>
              <p className="text-slate-500 capitalize">{userRole}</p>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>

          {saveMessage && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {saveMessage}
            </div>
          )}

          {saveError && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label htmlFor="profile-name" className="text-sm font-medium text-slate-600">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className={inputClassName}
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="text-sm font-medium text-slate-600">
                  Email Address
                </label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={inputClassName}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label htmlFor="profile-department" className="text-sm font-medium text-slate-600">
                  Department
                </label>
                <input
                  id="profile-department"
                  name="department"
                  type="text"
                  value={formData.department}
                  onChange={handleChange}
                  className={inputClassName}
                  required
                />
              </div>

              <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Your USN and account role are kept unchanged because they identify your campus account.
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">USN (University Seat Number)</p>
                  <p className="font-semibold text-slate-900">{userUsn}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Email Address</p>
                  <p className="font-semibold text-slate-900">{userEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Department</p>
                  <p className="font-semibold text-slate-900">{department}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Account Role</p>
                  <p className="font-semibold text-slate-900 capitalize">{userRole}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
