import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Projector, Wifi, Monitor, Snowflake, Printer, 
  MoreHorizontal, Image as ImageIcon, CheckCircle2, ArrowLeft 
} from 'lucide-react';
import { addReport } from '../../data/mockData';
import clsx from 'clsx';

const issueTypes = [
  { id: 'projector', label: 'Projector', icon: Projector },
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'computer', label: 'Computer', icon: Monitor },
  { id: 'ac', label: 'AC', icon: Snowflake },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

const ReportIssue = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    issueType: '',
    location: '',
    equipment: '',
    description: '',
    severity: 'Medium',
    image: null
  });
  const [incidentId, setIncidentId] = useState('');

  const handleNext = () => setStep(s => Math.min(3, s + 1));
  const handleBack = () => setStep(s => Math.max(1, s - 1));
  
  const handleSubmit = () => {
    const newId = `INC-${Math.floor(Math.random() * 1000) + 200}`;
    const newReport = {
      id: newId,
      category: formData.issueType || 'Other',
      equipment: formData.equipment || (formData.issueType || 'Equipment'),
      location: formData.location,
      description: formData.description,
      status: 'Under Investigation',
      severity: formData.severity,
      date: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }),
      timeline: [
        { status: 'Report submitted', date: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }), active: true }
      ]
    };
    addReport(newReport);
    setIncidentId(newId);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Report Submitted!</h2>
          <p className="text-slate-500 mb-8 max-w-sm">
            Your report has been successfully submitted. We'll notify you when there is an update.
          </p>
          
          <div className="bg-slate-50 w-full rounded-2xl p-6 mb-8">
            <p className="text-sm text-slate-500 mb-1">Incident ID</p>
            <p className="text-2xl font-bold text-slate-900">{incidentId}</p>
          </div>

          <button
            onClick={() => navigate('/student/my-reports')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors mb-3"
          >
            View My Reports
          </button>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setStep(1);
              setFormData({ issueType: '', location: '', equipment: '', description: '', severity: 'Medium', image: null });
            }}
            className="w-full py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors"
          >
            Submit Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header and Progress */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Report an Issue</h1>
        
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 -z-10 transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          
          {['Issue Type', 'Details', 'Review'].map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = step >= stepNum;
            return (
              <div key={label} className="flex flex-col items-center gap-2 bg-campus-bg px-2">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                  isActive ? 'bg-blue-600 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'
                )}>
                  {stepNum}
                </div>
                <span className={clsx(
                  'text-xs font-medium',
                  isActive ? 'text-slate-900' : 'text-slate-400'
                )}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        
        {/* Step 1: Issue Type */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">What seems to be the problem?</h2>
              <p className="text-sm text-slate-500">Select the category that best matches your issue.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {issueTypes.map(type => {
                const isSelected = formData.issueType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setFormData({...formData, issueType: type.id})}
                    className={clsx(
                      'flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all',
                      isSelected 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700' 
                        : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50 text-slate-600'
                    )}
                  >
                    <type.icon className={clsx('w-8 h-8', isSelected ? 'text-blue-600' : 'text-slate-400')} />
                    <span className="font-medium text-sm">{type.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                disabled={!formData.issueType}
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Provide more details</h2>
              <p className="text-sm text-slate-500">Help us locate and understand the issue.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Location *</label>
                <select 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select location</option>
                  <option value="Lab 204">Lab 204</option>
                  <option value="Lab 101">Lab 101</option>
                  <option value="Block A">Block A</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Specific equipment (optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. Projector P001"
                  value={formData.equipment}
                  onChange={e => setFormData({...formData, equipment: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Describe the issue *</label>
                <textarea 
                  rows={4}
                  placeholder="Tell us what happened... (e.g. flickering, not turning on)"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Severity *</label>
                <div className="flex gap-3">
                  {['Low', 'Medium', 'High'].map(level => (
                    <button
                      key={level}
                      onClick={() => setFormData({...formData, severity: level})}
                      className={clsx(
                        'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all',
                        formData.severity === level
                          ? level === 'Low' ? 'bg-green-50 border-green-200 text-green-700'
                            : level === 'Medium' ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Add a photo (optional)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-500">JPG, PNG (Max 5MB)</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 text-slate-500 font-medium hover:text-slate-700 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!formData.location || !formData.description}
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Review your report</h2>
              <p className="text-sm text-slate-500">Please check the details before submitting.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-slate-200">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                  {React.createElement(issueTypes.find(t => t.id === formData.issueType)?.icon || MoreHorizontal, { className: 'w-6 h-6 text-blue-600' })}
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Issue Type</p>
                  <p className="text-lg font-bold text-slate-900 capitalize">{formData.issueType}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 text-sm">
                <div>
                  <p className="text-slate-500 font-medium mb-1">Location</p>
                  <p className="font-semibold text-slate-900">{formData.location}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium mb-1">Equipment</p>
                  <p className="font-semibold text-slate-900">{formData.equipment || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 font-medium mb-1">Severity</p>
                  <span className={clsx(
                    'px-2.5 py-1 rounded-full text-xs font-bold inline-block',
                    formData.severity === 'Low' ? 'bg-green-100 text-green-700' :
                    formData.severity === 'Medium' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {formData.severity}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 font-medium mb-1">Description</p>
                  <p className="font-medium text-slate-900 leading-relaxed">{formData.description}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={handleBack}
                className="px-6 py-3 text-slate-500 font-medium hover:text-slate-700 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                Submit Report
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportIssue;
