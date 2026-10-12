import React from 'react';
import { Box, Typography } from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

export interface RileysToyoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'compact' | 'icon';
}

export const RileysToyoLogo: React.FC<RileysToyoLogoProps> = ({
  size = 'lg',
  variant = 'full',
}) => {
  const isSm = size === 'sm';
  const isMd = size === 'md';
  const isLg = size === 'lg';

  const iconDim = isSm ? 28 : isMd ? 36 : isLg ? 46 : 56;
  const brandFontSize = isSm ? '1rem' : isMd ? '1.25rem' : isLg ? '1.6rem' : '2.1rem';
  const tagFontSize = isSm ? '0.6rem' : isMd ? '0.68rem' : isLg ? '0.75rem' : '0.85rem';

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: isSm ? 1.2 : 2, userSelect: 'none' }}>
      {/* Dual Badges */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: isSm ? 0.6 : 1 }}>
        {/* Riley's Shield */}
        <Box
          sx={{
            width: iconDim,
            height: iconDim,
            borderRadius: isSm ? '8px' : '12px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.45)',
            border: '1px solid rgba(254, 202, 202, 0.4)',
            fontWeight: 900,
            fontFamily: '"Outfit", sans-serif',
            fontSize: isSm ? '1rem' : isMd ? '1.3rem' : isLg ? '1.6rem' : '2rem',
            lineHeight: 1
          }}
        >
          R
        </Box>

        {/* Divider dot / connector */}
        <Box
          sx={{
            width: isSm ? 4 : 6,
            height: isSm ? 4 : 6,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f87171, #38bdf8)',
            boxShadow: '0 0 8px rgba(56, 189, 248, 0.8)'
          }}
        />

        {/* Toyo Precision Icon Tile */}
        <Box
          sx={{
            width: iconDim,
            height: iconDim,
            borderRadius: isSm ? '8px' : '12px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.45)',
            border: '1px solid rgba(186, 230, 253, 0.4)'
          }}
        >
          <PrecisionManufacturingIcon sx={{ fontSize: isSm ? 18 : isMd ? 22 : isLg ? 28 : 34 }} />
        </Box>
      </Box>

      {/* Typography */}
      {variant !== 'icon' && (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 900,
                fontFamily: '"Outfit", sans-serif',
                fontSize: brandFontSize,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                background: 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textTransform: 'uppercase'
              }}
            >
              Riley's
            </Typography>
            <Typography
              component="span"
              sx={{
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: brandFontSize,
                lineHeight: 1
              }}
            >
              &amp;
            </Typography>
            <Typography
              component="span"
              sx={{
                fontWeight: 900,
                fontFamily: '"Outfit", sans-serif',
                fontSize: brandFontSize,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                background: 'linear-gradient(135deg, #7dd3fc 0%, #0284c7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textTransform: 'uppercase'
              }}
            >
              Toyo
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              fontSize: tagFontSize,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#cbd5e1',
              mt: 0.2,
              lineHeight: 1
            }}
          >
            Production Planning System
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RileysToyoLogo;
