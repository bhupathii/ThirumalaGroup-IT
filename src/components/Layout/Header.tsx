import React from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Header: React.FC = () => {
  const today = new Date();
  const { user } = useAuth();

  return (
    <>
      <header className='bg-white shadow-sm border-b border-gray-200 px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <h2 className='text-xl font-semibold text-gray-900'>
              Dashboard
            </h2>
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Calendar className='w-4 h-4' />
              {format(today, 'EEEE, MMMM do, yyyy')}
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2 text-sm'>
              <span className='text-gray-600'>Welcome,</span>
              <span className='font-semibold text-gray-900'>{user?.username}</span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
