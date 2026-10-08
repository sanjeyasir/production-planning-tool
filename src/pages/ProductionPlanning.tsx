import React from 'react';
import { Navigate } from 'react-router-dom';

export const ProductionPlanning: React.FC = () => {
  return <Navigate to="/production-schedule" replace />;
};

export default ProductionPlanning;
