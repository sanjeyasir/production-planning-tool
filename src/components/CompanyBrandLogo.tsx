import React from 'react';
import { Box, Typography } from '@mui/material';
import { RileysLogo } from './RileysLogo';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

export interface CompanyBrandLogoProps {
  company: 'rileys' | 'toyo';
  variant?: 'full' | 'compact' | 'icon';
  themeMode?: 'sidebar' | 'dark' | 'red' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

export const CompanyBrandLogo: React.FC<CompanyBrandLogoProps> = ({
  company,
  variant = 'full',
  themeMode = 'sidebar',
  size = 'sm'
}) => {
  if (company === 'toyo') {
    const isIconOnly = variant === 'icon';
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: isIconOnly ? 32 : 36,
            height: isIconOnly ? 32 : 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 60%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 3px 10px rgba(2, 132, 199, 0.4)',
            flexShrink: 0
          }}
        >
          <PrecisionManufacturingIcon sx={{ fontSize: isIconOnly ? 18 : 20 }} />
        </Box>
        {!isIconOnly && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 900,
                color: '#0f172a',
                fontFamily: '"Outfit", sans-serif',
                letterSpacing: '0.04em',
                lineHeight: 1.1,
                fontSize: size === 'sm' ? '1rem' : '1.25rem'
              }}
            >
              TOYO
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#0284c7',
                fontWeight: 800,
                fontSize: '0.62rem',
                letterSpacing: '0.08em',
                display: 'block',
                textTransform: 'uppercase',
                lineHeight: 1
              }}
            >
              Manufacturing
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  return <RileysLogo size={size} variant={variant} themeMode={themeMode} />;
};

export default CompanyBrandLogo;
