import React from 'react';
import { Box, Typography } from '@mui/material';

export interface RileysLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'compact' | 'icon' | 'horizontal';
  themeMode?: 'red' | 'dark' | 'light' | 'sidebar';
  showTagline?: boolean;
}

export const RileysLogo: React.FC<RileysLogoProps> = ({
  size = 'md',
  variant = 'full',
  themeMode = 'red',
  showTagline = true,
}) => {
  // Dimensions based on size
  const dimensions = {
    sm: { iconSize: 32, brandSize: '1rem', tagSize: '0.62rem', gap: 1 },
    md: { iconSize: 42, brandSize: '1.25rem', tagSize: '0.68rem', gap: 1.25 },
    lg: { iconSize: 56, brandSize: '1.65rem', tagSize: '0.75rem', gap: 1.5 },
    xl: { iconSize: 68, brandSize: '2rem', tagSize: '0.82rem', gap: 1.75 },
  }[size];

  // Palette configs
  const isRed = themeMode === 'red';
  const isDark = themeMode === 'dark' || isRed;
  const isSidebar = themeMode === 'sidebar';

  const gradientId = `rileyGrad-${themeMode}-${size}`;
  const glowId = `rileyGlow-${themeMode}-${size}`;

  // SVG Icon Mark
  const iconMark = (
    <Box
      sx={{
        width: dimensions.iconSize,
        height: dimensions.iconSize,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        filter: isRed
          ? 'drop-shadow(0 4px 12px rgba(239, 68, 68, 0.45))'
          : isSidebar
          ? 'drop-shadow(0 3px 8px rgba(220, 38, 38, 0.25))'
          : 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.15))',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        '&:hover': {
          transform: 'scale(1.05)',
        },
      }}
    >
      <svg
        width={dimensions.iconSize}
        height={dimensions.iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Primary Gradient */}
          <linearGradient id={`${gradientId}-primary`} x1="0%" y1="0%" x2="100%" y2="100%">
            {isRed || isSidebar ? (
              <>
                <stop offset="0%" stopColor="#ff4d4d" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
              </>
            ) : isDark ? (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
              </>
            )}
          </linearGradient>

          {/* Accent Gold/Cyan or Amber Spark */}
          <linearGradient id={`${gradientId}-accent`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>

          {/* Background Badge Gradient */}
          <linearGradient id={`${gradientId}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            {isRed ? (
              <>
                <stop offset="0%" stopColor="#1a0b0e" />
                <stop offset="100%" stopColor="#0d0406" />
              </>
            ) : isSidebar ? (
              <>
                <stop offset="0%" stopColor="#1e1b20" />
                <stop offset="100%" stopColor="#110d14" />
              </>
            ) : isDark ? (
              <>
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </>
            )}
          </linearGradient>

          {/* Glow Filter */}
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagonal Shield with Rounded Vertices */}
        <path
          d="M50 4 L88 23 C91 24.5 93 28 93 32 L93 68 C93 72 91 75.5 88 77 L50 96 C47 97.5 43 97.5 40 96 L12 77 C9 75.5 7 72 7 68 L7 32 C7 28 9 24.5 12 23 L50 4 Z"
          fill={`url(#${gradientId}-bg)`}
          stroke={`url(#${gradientId}-primary)`}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Inner Geometric Circuit / Production Track Accents */}
        <path
          d="M20 36 L30 36 L40 22 L60 22 L70 36 L80 36"
          stroke={isRed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(220, 38, 38, 0.25)'}
          strokeWidth="2"
          strokeDasharray="3 3"
        />
        <path
          d="M20 64 L32 64 L42 78 L58 78 L68 64 L80 64"
          stroke={isRed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(220, 38, 38, 0.25)'}
          strokeWidth="2"
          strokeDasharray="3 3"
        />

        {/* Central Monogram 'R' Precision Silhouette */}
        {/* Vertical Spine */}
        <rect
          x="32"
          y="28"
          width="11"
          height="44"
          rx="5.5"
          fill={`url(#${gradientId}-primary)`}
        />

        {/* Upper Loop of 'R' */}
        <path
          d="M37 28 H56 C64 28 70 33.5 70 41.5 C70 49.5 64 55 56 55 H37 Z"
          fill="none"
          stroke={`url(#${gradientId}-primary)`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dynamic Forward Production Kick / Leg */}
        <path
          d="M51 51 L68 70 C69.5 71.5 72 71.5 73.5 70 L74 69.5 C75.5 68 75.5 65.5 74 64 L58 48 Z"
          fill={`url(#${gradientId}-primary)`}
        />

        {/* Precision Planning Dot / Telemetry Pulse */}
        <circle
          cx="52"
          cy="41.5"
          r="4.5"
          fill={`url(#${gradientId}-accent)`}
        />

        {/* Mini Speed Flow / Production Status Chevron */}
        <path
          d="M74 30 L80 36 L74 42"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );

  if (variant === 'icon') {
    return iconMark;
  }

  // Wordmark & Subtitle
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dimensions.gap,
        userSelect: 'none',
      }}
    >
      {iconMark}

      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Brand Name: RILEY'S */}
        <Typography
          component="span"
          sx={{
            fontFamily: '"Outfit", "Inter", sans-serif',
            fontWeight: 900,
            fontSize: dimensions.brandSize,
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isDark ? '#ffffff' : '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          Riley’s
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: size === 'xl' ? 8 : size === 'lg' ? 6 : 5,
              height: size === 'xl' ? 8 : size === 'lg' ? 6 : 5,
              borderRadius: '50%',
              bgcolor: '#ef4444',
              boxShadow: '0 0 8px #ef4444',
            }}
          />
        </Typography>

        {/* Tagline: PRODUCTION & PLANNING */}
        {showTagline && variant !== 'compact' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 0.2,
            }}
          >
            <Typography
              component="span"
              sx={{
                fontFamily: '"Outfit", "Inter", sans-serif',
                fontWeight: 800,
                fontSize: dimensions.tagSize,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: isRed
                  ? 'linear-gradient(90deg, #f87171 0%, #fca5a5 100%)'
                  : isDark
                  ? 'linear-gradient(90deg, #fca5a5 0%, #ef4444 100%)'
                  : 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1,
              }}
            >
              Production & Planning
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default RileysLogo;
