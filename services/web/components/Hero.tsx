import React from 'react';

const Hero: React.FC = () => {
  return (
    <div className="relative bg-[#57068c] text-white pt-16 pb-20 px-6 sm:px-12 lg:px-20 overflow-hidden">
      {/* Abstract Background Pattern */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative max-w-4xl mx-auto text-center space-y-8">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
          The Marketplace for <br />
          <span className="text-yellow-300">NYU Students</span>
        </h1>
        <p className="text-xl md:text-2xl text-purple-100 max-w-2xl mx-auto leading-relaxed">
          Buy, sell, and swap textbooks, furniture, and dorm essentials safely within the campus community.
        </p>
      </div>
    </div>
  );
};

export default Hero;