import React from 'react';

interface AuthSplitLayoutProps {
  isFormOnLeft?: boolean;
  mode?: 'login' | 'signup';
  brandPanel: React.ReactNode;
  formContent: React.ReactNode;
}

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  isFormOnLeft,
  mode,
  brandPanel,
  formContent,
}) => {
  const formOnLeft = isFormOnLeft !== undefined ? isFormOnLeft : mode === 'signup';

  return (
    <div className="relative w-full min-h-screen bg-[#000000] text-zinc-100 flex flex-col lg:flex-row overflow-hidden font-sans antialiased selection:bg-zinc-800 selection:text-white">
      {/* 
        Brand Panel:
        If form is on right (formOnLeft === false), brand is at 0 (left).
        If form is on left (formOnLeft === true), brand translates +100% (right).
      */}
      <div
        style={{ willChange: 'transform' }}
        className={`w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center bg-[#000000] transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] z-10 ${
          formOnLeft ? 'lg:translate-x-full' : 'lg:translate-x-0'
        }`}
      >
        {brandPanel}
      </div>

      {/* 
        Auth Form Panel:
        If form is on right (formOnLeft === false), form is at 0 (right).
        If form is on left (formOnLeft === true), form translates -100% (left).
      */}
      <div
        style={{ willChange: 'transform' }}
        className={`w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14 bg-[#050505] border-l border-[#1A1A1A] transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] z-20 ${
          formOnLeft ? 'lg:-translate-x-full' : 'lg:translate-x-0'
        }`}
      >
        <div className="w-full max-w-sm flex flex-col justify-center items-center my-auto py-8">
          {formContent}
        </div>
      </div>
    </div>
  );
};
