import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Projector, Wifi, Monitor, Snowflake, Printer,
  MoreHorizontal, Image as ImageIcon, CheckCircle2, ArrowLeft,
  AlertCircle, Loader2
} from 'lucide-react';
import { addReport, user } from '../../data/mockData';
import {
  getEquipment,
  createReport,
  uploadReportImage,
  getActiveStudentId
} from '../../services/api';
import clsx from 'clsx';

const issueTypes = [
  { id: 'projector', label: 'Projector', icon: Projector },
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'computer', label: 'Computer', icon: Monitor },
  { id: 'ac', label: 'AC', icon: Snowflake },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

const DEFAULT_LOCATIONS = [
  'Lab 204',
  'Lab 101',
  'Block A',
  'Block B',
  'Computer Lab 2',
  'Library',
  'Admin Block',
];

const ReportIssue = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageUploadWarning, setImageUploadWarning] = useState('');
  const imageInputRef = useRef(null);

  // Equipment data from Redis backend
  const [equipmentList, setEquipmentList] = useState([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  const [equipmentError, setEquipmentError] = useState('');

  const [formData, setFormData] = useState({
    issueType: '',
    location: '',
    equipment: '', // equipment_id
    description: '',
    severity: 'Medium',
    image: null,
  });

  const [submittedReportId, setSubmittedReportId] = useState('');
  const [submittedStreamId, setSubmittedStreamId] = useState('');

  // Fetch actual equipment list from backend on mount
  useEffect(() => {
    let isMounted = true;
    const fetchEquipmentData = async () => {
      setIsLoadingEquipment(true);
      try {
        const data = await getEquipment();
        if (isMounted && data && Array.isArray(data.equipment)) {
          setEquipmentList(data.equipment);
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Could not fetch equipment from backend:", err.message);
          setEquipmentError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingEquipment(false);
        }
      }
    };

    fetchEquipmentData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!formData.image) {
      setImagePreview('');
      return;
    }

    const previewUrl = URL.createObjectURL(formData.image);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [formData.image]);

  // Compute dynamic location choices from equipment + defaults
  const availableLocations = Array.from(
    new Set([
      ...DEFAULT_LOCATIONS,
      ...equipmentList.map(eq => eq.location).filter(Boolean),
    ])
  );

  const handleNext = () => {
    setErrorMessage('');
    setStep(s => Math.min(3, s + 1));
  };

  const handleBack = () => {
    setErrorMessage('');
    setStep(s => Math.max(1, s - 1));
  };

  const handleEquipmentChange = (selectedId) => {
    const selectedEq = equipmentList.find(eq => eq.id === selectedId);
    setFormData(prev => ({
      ...prev,
      equipment: selectedId,
      // Auto-populate location if not yet selected
      location: (!prev.location && selectedEq?.location) ? selectedEq.location : prev.location,
    }));
  };
  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please select a JPG, PNG or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must not exceed 5 MB.');
      event.target.value = '';
      return;
    }

    setErrorMessage('');

    setFormData(prev => ({
      ...prev,
      image: file
    }));
  };

  const removeSelectedImage = () => {
    setFormData(prev => ({
      ...prev,
      image: null
    }));

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };
  const handleSubmit = async () => {
    // Form validations
    if (!formData.issueType) {
      setErrorMessage('Please select an issue category.');
      setStep(1);
      return;
    }
    if (!formData.location?.trim()) {
      setErrorMessage('Location is required.');
      setStep(2);
      return;
    }
    if (!formData.description?.trim()) {
      setErrorMessage('Description is required.');
      setStep(2);
      return;
    }

    const typeObj = issueTypes.find(t => t.id === formData.issueType);
    const categoryName = typeObj ? typeObj.label : 'Other';
    const reportTitle = `${categoryName} issue in ${formData.location}`;

    // Resolve student ID: check active session first, then user object, fallback to default
    const studentId = getActiveStudentId() || user?.usn || user?.id || '1RV20CS054';

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await createReport({
        student_id: studentId,
        title: reportTitle,
        description: formData.description.trim(),
        category: categoryName,
        location: formData.location.trim(),
        equipment_id: formData.equipment ? formData.equipment.trim() : null,
      });

      const reportData = response.report || {};
      const reportId = reportData.report_id || `REP-${Date.now()}`;
      const streamId = response.stream_id || '';

      // Upload the image separately after report creation.
      // A failed image upload must not cause duplicate report submissions.
      let uploadWarning = '';

      if (formData.image) {
        try {
          await uploadReportImage(reportId, formData.image);
        } catch (imageError) {
          console.error('Image upload failed:', imageError);

          uploadWarning =
            'Your report was submitted successfully, but the image could not be uploaded. You can submit the report without the image.';
        }
      }

      setImageUploadWarning(uploadWarning);

      setSubmittedReportId(reportId);
      setSubmittedStreamId(streamId);

      // Save to student's local list for viewing in MyReports without querying global stream
      const selectedEq = equipmentList.find(eq => eq.id === formData.equipment);
      const equipmentDisplay = selectedEq
        ? `${selectedEq.name} (${selectedEq.id})`
        : (formData.equipment || categoryName);

      addReport({
        id: reportId,
        category: categoryName,
        equipment: equipmentDisplay,
        location: formData.location,
        description: formData.description,
        status: 'Under Investigation',
        severity: formData.severity,
        date: new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: 'numeric', hour12: true
        }),
        timeline: [
          {
            status: 'Report submitted to campus stream',
            date: new Date().toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
            }),
            active: true
          }
        ]
      });

      // Clear the form only after successful submission
      setFormData({
        issueType: '',
        location: '',
        equipment: '',
        description: '',
        severity: 'Medium',
        image: null,
      });

      setIsSubmitted(true);
    } catch (err) {
      console.error("Report submission failed:", err);
      setErrorMessage(err.message || 'Failed to submit report. Please check your backend connection.');
    } finally {
      setIsSubmitting(false);
    }
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
            Your issue has been recorded in the Redis Stream. The background consumer will group and prioritize it.
          </p>

          {imageUploadWarning && (
            <div className="w-full mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              {imageUploadWarning}
            </div>
          )}

          <div className="bg-slate-50 w-full rounded-2xl p-6 mb-8 text-left">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Report Reference</span>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                Queued
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-1">Report ID</p>
            <p className="text-xl font-bold text-slate-900 font-mono mb-2">{submittedReportId}</p>
            {submittedStreamId && (
              <p className="text-xs text-slate-400">Stream Event ID: {submittedStreamId}</p>
            )}
          </div>

          <button
            onClick={() => navigate('/student/my-reports')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors mb-3 shadow-sm"
          >
            View My Reports
          </button>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setStep(1);
              setSubmittedReportId('');
              setSubmittedStreamId('');
              setErrorMessage('');
              setImageUploadWarning('');
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
        <button
          type="button"
          onClick={() => navigate('/student/dashboard')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Report an Issue</h1>

        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 -z-10 transition-all duration-300"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          ></div>

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

      {/* Error banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

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
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setFormData({ ...formData, issueType: type.id });
                    }}
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
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                disabled={!formData.issueType}
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm"
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
                  onChange={e => {
                    setErrorMessage('');
                    setFormData({ ...formData, location: e.target.value });
                  }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select location</option>
                  {availableLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Add a photo (optional)
                  </label>

                  {!formData.image ? (
                    <label className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />

                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      </div>

                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Click to upload an image
                      </p>

                      <p className="text-xs text-slate-500">
                        JPG, PNG or WebP (Max 5 MB)
                      </p>
                    </label>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-4">
                      <img
                        src={imagePreview}
                        alt="Selected report"
                        className="w-full max-h-64 object-contain rounded-xl"
                      />

                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-slate-600 truncate mr-3">
                          {formData.image.name}
                        </p>

                        <button
                          type="button"
                          onClick={removeSelectedImage}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <select
                  value={formData.equipment}
                  onChange={e => handleEquipmentChange(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None / General Issue</option>
                  {equipmentList.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.id} — {eq.name} ({eq.location || 'Campus'})
                    </option>
                  ))}
                </select>
                {equipmentError && (
                  <p className="text-xs text-amber-600 mt-1">
                    Note: Backend equipment list unavailable ({equipmentError}). You may still proceed with location.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Describe the issue *</label>
                <textarea
                  rows={4}
                  placeholder="Tell us what happened... (e.g. flickering, not turning on)"
                  value={formData.description}
                  onChange={e => {
                    setErrorMessage('');
                    setFormData({ ...formData, description: e.target.value });
                  }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Severity *</label>
                <div className="flex gap-3">
                  {['Low', 'Medium', 'High'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, severity: level })}
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

            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-3 text-slate-500 font-medium hover:text-slate-700 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={!formData.location || !formData.description}
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm"
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
              <p className="text-sm text-slate-500">Please check the details before submitting to CampusCare.</p>
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
                  <p className="font-semibold text-slate-900">
                    {formData.equipment
                      ? (equipmentList.find(eq => eq.id === formData.equipment)?.name
                        ? `${equipmentList.find(eq => eq.id === formData.equipment).name} (${formData.equipment})`
                        : formData.equipment)
                      : 'None / General'}
                  </p>
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
                type="button"
                disabled={isSubmitting}
                onClick={handleBack}
                className="px-6 py-3 text-slate-500 font-medium hover:text-slate-700 flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportIssue;
