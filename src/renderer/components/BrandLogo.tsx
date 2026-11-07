import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Nakliye Defterim Logo"
    >
      <defs>
        <linearGradient id="ndForestBg" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#265E48" />
          <stop offset="100%" stopColor="#16382B" />
        </linearGradient>
        <linearGradient id="ndChampagneAccent" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DEC38F" />
          <stop offset="50%" stopColor="#C5A872" />
          <stop offset="100%" stopColor="#9E7E46" />
        </linearGradient>
      </defs>

      {/* Rounded Architectural Squircle Crest */}
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="15"
        fill="url(#ndForestBg)"
        stroke="url(#ndChampagneAccent)"
        strokeWidth="2"
      />

      {/* Subtle Inner Frame */}
      <rect
        x="8"
        y="8"
        width="48"
        height="48"
        rx="11.5"
        stroke="#DEC38F"
        strokeOpacity="0.18"
        strokeWidth="1"
      />

      {/* Minimalist Express Road / Logistics Motion Ribbon */}
      <path
        d="M13 46.5C23 42.5 41 42.5 51 46.5"
        stroke="url(#ndChampagneAccent)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M20 50.5C27 48.2 37 48.2 44 50.5"
        stroke="#DEC38F"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Sleek Tanker Silhouette (Cylinder + Aerodynamic Cab) */}
      <rect
        x="12"
        y="22.5"
        width="25"
        height="12"
        rx="6"
        fill="#F6F5F0"
      />
      {/* Champagne Signature Line on Tanker */}
      <path
        d="M16.5 28.5H32.5"
        stroke="url(#ndChampagneAccent)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Aerodynamic Tractor Cab */}
      <path
        d="M39 24H45.8C47.5 24 49 25.1 49.6 26.7L51.4 31.5C51.8 32.5 52 33.5 52 34.5V36C52 36.8 51.3 37.5 50.5 37.5H39V24Z"
        fill="#F6F5F0"
      />
      {/* Cab Window */}
      <path
        d="M42 26.2H46.2L48 30.8H42V26.2Z"
        fill="#1B4333"
      />

      {/* Chassis Bar */}
      <rect
        x="13.5"
        y="35.8"
        width="36.5"
        height="2"
        rx="1"
        fill="url(#ndChampagneAccent)"
      />

      {/* Precision Wheels */}
      <circle cx="19" cy="39.5" r="3.2" fill="#141716" stroke="url(#ndChampagneAccent)" strokeWidth="1.6" />
      <circle cx="27.5" cy="39.5" r="3.2" fill="#141716" stroke="url(#ndChampagneAccent)" strokeWidth="1.6" />
      <circle cx="45.5" cy="39.5" r="3.2" fill="#141716" stroke="url(#ndChampagneAccent)" strokeWidth="1.6" />
    </svg>
  );
};
