import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableMode } from '../contexts/TableModeContext';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/UI/Button';
import { FileCheck, Briefcase, Wallet } from 'lucide-react';

const ModeSelection: React.FC = () => {
  const navigate = useNavigate();
  const { setMode } = useTableMode();
  const { user } = useAuth();

  // Menu items mapping (same as Sidebar)
  const menuItems = [
    { path: '/', key: 'dashboard' },
    { path: '/new-entry', key: 'new_entry' },
    { path: '/edit-entry', key: 'edit_entry' },
    { path: '/daily-report', key: 'daily_report' },
    { path: '/detailed-ledger', key: 'detailed_ledger' },
    { path: '/ledger-summary', key: 'ledger_summary' },
    { path: '/approve-records', key: 'approve_records' },
    { path: '/edited-records', key: 'edited_records' },
    { path: '/deleted-records', key: 'deleted_records' },
    { path: '/replace-form', key: 'replace_form' },
    { path: '/export-excel', key: 'export' },
    { path: '/csv-upload', key: 'csv_upload' },
    { path: '/balance-sheet', key: 'balance_sheet' },
    { path: '/vehicles', key: 'vehicles' },
    { path: '/bank-guarantees', key: 'bank_guarantees' },
    { path: '/drivers', key: 'drivers' },
    { path: '/user-management', key: 'users', adminOnly: true },
  ];

  // Get the first available feature path for the user
  const getFirstAvailableFeature = (mode: 'regular' | 'itr') => {
    const isAdmin = user?.is_admin || false;
    const featuresByMode = user?.featuresByMode || {};
    
    // Get features for the selected mode
    const features = isAdmin 
      ? menuItems.map(item => item.key) // Admins have all features
      : (featuresByMode[mode] || []);
    
    // Find the first menu item that matches a user feature (skip dashboard)
    for (const item of menuItems) {
      // Skip admin-only items for non-admins
      if (item.adminOnly && !isAdmin) continue;
      
      // Skip dashboard - we want the first actual feature
      if (item.key === 'dashboard') continue;
      
      // If user has this feature, return its path
      if (features.includes(item.key)) {
        return item.path;
      }
    }
    
    // Fallback to dashboard if no features found (shouldn't happen)
    return '/';
  };

  const handleRegularMode = () => {
    setMode('regular');
    const firstFeature = getFirstAvailableFeature('regular');
    navigate(firstFeature);
  };

  const handleITRMode = () => {
    setMode('itr');
    const firstFeature = getFirstAvailableFeature('itr');
    navigate(firstFeature);
  };

  const handleFinanceMode = () => {
    // Finance mode - navigate to first available feature
    setMode('regular'); // Finance uses regular mode
    const firstFeature = getFirstAvailableFeature('regular');
    navigate(firstFeature);
  };

  // Determine which modes the user can access based on their features
  // Admins have access to all modes
  const isAdmin = user?.is_admin || false;
  const featuresByMode = user?.featuresByMode || {};
  
  // Check if user has features in regular mode
  const hasRegularFeatures = isAdmin || (featuresByMode.regular && featuresByMode.regular.length > 0);
  // Check if user has features in ITR mode
  const hasITRFeatures = isAdmin || (featuresByMode.itr && featuresByMode.itr.length > 0);
  
  // Show Finance option only for admin users
  const showFinance = isAdmin;
  
  // Determine grid layout based on number of visible buttons
  const visibleButtons = [hasRegularFeatures, hasITRFeatures, showFinance].filter(Boolean).length;
  let gridCols = 'grid-cols-1';
  if (visibleButtons === 2) {
    gridCols = 'grid-cols-1 sm:grid-cols-2';
  } else if (visibleButtons === 3) {
    gridCols = 'grid-cols-1 sm:grid-cols-2';
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 flex items-center justify-center p-4'>
      <div className='max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden'>
        {/* Logo/Image and Title */}
        <div className='flex flex-col items-center justify-center px-8 pt-8 pb-6'>
          <img
            src='https://pmqeegdmcrktccszgbwu.supabase.co/storage/v1/object/public/images//download.jpeg.jpg'
            alt='Thirumala Group'
            className='w-48 h-48 object-contain mb-4 rounded-xl shadow'
          />
          <h1 className='text-3xl font-bold text-gray-900 text-center'>
            Thirumala Group
          </h1>
          <p className='text-gray-600 mt-2 text-center'>
            Cotton Business Management
          </p>
          <p className='text-gray-500 text-sm mt-1 text-center'>
            श्री तिरुमला कॉटन मिल्स
          </p>
        </div>

        {/* Mode Selection Buttons */}
        <div className='px-8 py-6'>
          <div className={`grid ${gridCols} gap-4`}>
            {hasRegularFeatures && (
              <Button
                onClick={handleRegularMode}
                className='w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-6 text-lg font-semibold shadow-lg flex flex-col gap-2'
              >
                <Briefcase className='w-8 h-8' />
                Regular Mode
              </Button>
            )}

            {hasITRFeatures && (
              <Button
                onClick={handleITRMode}
                className='w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-6 text-lg font-semibold shadow-lg flex flex-col gap-2'
              >
                <FileCheck className='w-8 h-8' />
                ITR Mode
              </Button>
            )}

            {showFinance && (
              <Button
                onClick={handleFinanceMode}
                className='w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:to-emerald-700 text-white py-6 text-lg font-semibold shadow-lg flex flex-col gap-2'
              >
                <Wallet className='w-8 h-8' />
                Finance
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;

