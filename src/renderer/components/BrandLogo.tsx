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
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Nakliye Defterim ND Logo"
    >
      <defs>
        {/* Squircle Background: Deep Obsidian Forest */}
        <linearGradient id="ndBg" x1="20" y1="10" x2="220" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D2622" />
          <stop offset="55%" stopColor="#141A17" />
          <stop offset="100%" stopColor="#0E1210" />
        </linearGradient>

        {/* Subtle Ambient Glow behind Emblem */}
        <radialGradient id="ndGlow" cx="128" cy="118" r="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2D6E55" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#141A17" stopOpacity="0" />
        </radialGradient>

        {/* Primary Accent: Rich Forest Emerald */}
        <linearGradient id="ndEmerald" x1="80" y1="12" x2="200" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3FA17C" />
          <stop offset="55%" stopColor="#2E775B" />
          <stop offset="100%" stopColor="#205540" />
        </linearGradient>

        {/* Secondary Accent: Gleaming Champagne Gold */}
        <linearGradient id="ndGold" x1="65" y1="20" x2="170" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F2DAA6" />
          <stop offset="50%" stopColor="#D5B67C" />
          <stop offset="100%" stopColor="#AE8C50" />
        </linearGradient>

        {/* Metallic Anthracite Slate for N & Truck Cab */}
        <linearGradient id="ndAnthracite" x1="10" y1="12" x2="195" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#434E49" />
          <stop offset="100%" stopColor="#2A322F" />
        </linearGradient>

        {/* Darker Asphalt Gradient for Highway */}
        <linearGradient id="ndAsphalt" x1="75" y1="108" x2="168" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2D3632" />
          <stop offset="100%" stopColor="#39433F" />
        </linearGradient>

        {/* Crisp Ivory White */}
        <linearGradient id="ndIvory" x1="134" y1="68" x2="203" y2="109" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EAE7DF" />
        </linearGradient>

        <filter id="ndShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.48" />
        </filter>
      </defs>

      {/* Rounded Squircle App Icon Base */}
      <rect
        x="8"
        y="8"
        width="224"
        height="224"
        rx="52"
        fill="url(#ndBg)"
        stroke="url(#ndGold)"
        strokeWidth="3.5"
        strokeOpacity="0.58"
      />
      <rect
        x="15"
        y="15"
        width="210"
        height="210"
        rx="46"
        stroke="#DEC38F"
        strokeWidth="1.2"
        strokeOpacity="0.16"
      />
      <circle cx="128" cy="118" r="94" fill="url(#ndGlow)" />

      {/* MAIN "ND" EMBLEM GROUP */}
      <g transform="translate(14, 58)" filter="url(#ndShadow)">
        {/* 1. LEFT "N" (Metallic Anthracite: Left Stem + Diagonal) */}
        <path
          d="M 10 12 H 34 L 76 68 V 96 L 66 95 L 34 52 V 108.5 H 10 V 12 Z"
          fill="url(#ndAnthracite)"
        />

        {/* 2. RIGHT STEM OF "N" / LEFT NOTEBOOK PAGE (Forest Emerald) */}
        <path d="M 76 12 H 102 V 68 L 76 86 V 12 Z" fill="url(#ndEmerald)" />

        {/* 3. UPPER "D" & TRAILER BODY (Forest Emerald) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 111 12 H 150 C 181 12, 203 33, 203 63 V 68 H 111 V 12 Z
             M 137 32 H 153 C 162 32, 169 36, 171 42 H 137 V 32 Z"
          fill="url(#ndEmerald)"
        />

        {/* Speed Motion Cutout Lines inside D Trailer */}
        <rect x="129" y="45" width="29" height="2.5" rx="1.25" fill="#141A17" />
        <rect x="123" y="49.8" width="29" height="2.5" rx="1.25" fill="#141A17" />
        <rect x="117" y="54.6" width="26" height="2.5" rx="1.25" fill="#141A17" />

        {/* 4. TWO NOTEBOOK BINDER RINGS (Dark Punch Holes + Champagne Gold Bars) */}
        {/* Top Ring */}
        <circle cx="94" cy="26.5" r="6.3" fill="#141A17" />
        <circle cx="119" cy="26.5" r="6.3" fill="#141A17" />
        <rect x="92" y="21.4" width="29" height="10.2" rx="5.1" fill="#141A17" />
        <rect x="92.5" y="23.3" width="28" height="6.4" rx="3.2" fill="url(#ndGold)" />

        {/* Bottom Ring */}
        <circle cx="94" cy="44.5" r="6.3" fill="#141A17" />
        <circle cx="119" cy="44.5" r="6.3" fill="#141A17" />
        <rect x="92" y="39.4" width="29" height="10.2" rx="5.1" fill="#141A17" />
        <rect x="92.5" y="41.3" width="28" height="6.4" rx="3.2" fill="url(#ndGold)" />

        {/* 5. LOWER-RIGHT BOWL OF "D" (Crisp Ivory White) */}
        <path
          d="M 178 69 H 202.5 C 201 92, 182 108.5, 156 108.5 C 143 108.5, 134 101, 134 90 C 134 84, 135.5 79.5, 137 77 V 89 H 155 C 167 89, 176 81, 178 69 Z"
          fill="url(#ndIvory)"
        />

        {/* 6. TRUCK CAB & CHASSIS (Metallic Anthracite + Emerald Window) */}
        <path
          d="M 140 58.5 H 174 V 46 H 187.5 L 194.5 56 L 201.5 59.5 V 69 H 135 L 140 58.5 Z"
          fill="url(#ndAnthracite)"
          stroke="#141A17"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Truck Cab Window */}
        <path d="M 178 49.5 H 186 L 190.8 56 H 178 V 49.5 Z" fill="url(#ndEmerald)" />

        {/* 7. CURVED PERSPECTIVE HIGHWAY (Dark Outline + Gold Borders + Asphalt + White Dashes) */}
        <path
          d="M 63.5 93.8 C 81.5 71, 114 58, 168 58 L 170 60 C 127 65, 118 88, 150 109 H 78 L 63.5 93.8 Z"
          fill="#141A17"
        />
        {/* Left Champagne Gold Highway Border */}
        <path
          d="M 66 94.5 C 84 73, 116 59.5, 166 59.5 L 166 60.8 C 122 63, 91 77, 72 101.5 L 66 94.5 Z"
          fill="url(#ndGold)"
        />
        {/* Right Champagne Gold Highway Border */}
        <path
          d="M 169 60 C 126 65, 112 87, 136 108.5 H 148.5 C 120 89, 129 66, 169 60 Z"
          fill="url(#ndGold)"
        />
        {/* Highway Asphalt Road Bed */}
        <path
          d="M 72.5 101.5 C 91 77, 122 62.5, 166 60.5 C 126 65.5, 111 87, 135.5 108.5 H 79 L 72.5 101.5 Z"
          fill="url(#ndAsphalt)"
        />

        {/* Highway Center White Perspective Dashes */}
        <path d="M 95.5 108.5 L 96.8 95.5 H 103.8 L 103 108.5 H 95.5 Z" fill="url(#ndIvory)" />
        <path
          d="M 99.5 90 C 101.8 85.2, 104.8 81, 108.5 77.2 L 113.5 78.6 C 110.2 82.2, 107.4 86.2, 105.5 90.8 L 99.5 90 Z"
          fill="url(#ndIvory)"
        />
        <path
          d="M 114.5 73.2 C 118.2 70.4, 122.2 68, 126.8 66 L 130.2 67.4 C 126 69.3, 122.2 71.6, 118.8 74.4 L 114.5 73.2 Z"
          fill="url(#ndIvory)"
        />
        <path
          d="M 133.5 64 C 137.2 62.8, 141.2 61.9, 145.5 61.2 L 147.2 62.2 C 143.2 62.9, 139.5 63.8, 136 65 L 133.5 64 Z"
          fill="url(#ndIvory)"
        />

        {/* 8. TRUCK WHEEL */}
        <circle cx="188" cy="69" r="7.2" fill="#141A17" />
        <circle cx="188" cy="69" r="5.5" fill="url(#ndIvory)" />
        <circle cx="188" cy="69" r="4.1" fill="#29312E" />
        <circle cx="188" cy="69" r="2.1" fill="url(#ndIvory)" />
      </g>
    </svg>
  );
};
