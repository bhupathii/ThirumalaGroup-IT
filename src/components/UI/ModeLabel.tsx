import React from 'react';
import { useTableMode } from '../../contexts/TableModeContext';

const ModeLabel: React.FC = () => {
  const { mode, isITRMode } = useTableMode();
  
  return (
    <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shadow-sm' 
         style={{
           backgroundColor: isITRMode ? '#FEF3C7' : '#DBEAFE',
           color: isITRMode ? '#92400E' : '#1E40AF',
           border: `1px solid ${isITRMode ? '#FCD34D' : '#93C5FD'}`
         }}>
      <span className='w-2 h-2 rounded-full' 
            style={{
              backgroundColor: isITRMode ? '#F59E0B' : '#3B82F6'
            }}></span>
      {isITRMode ? 'ITR Mode' : 'Regular Mode'}
    </div>
  );
};

export default ModeLabel;

