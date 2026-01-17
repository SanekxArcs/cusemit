import React from 'react';
import { motion } from 'framer-motion';
import { DriftOffset } from '@/lib/amoledSaver';

interface AmoledMeshProps {
  type: 'pixel' | 'v-lines' | 'h-lines';
  driftOffset: DriftOffset;
  prefersReducedMotion: boolean;
}

export const AmoledMesh: React.FC<AmoledMeshProps> = ({
  type,
  driftOffset,
  prefersReducedMotion,
}) => {
  const getBackgroundImage = () => {
    switch (type) {
      case 'pixel':
        return `url("data:image/svg+xml,%3Csvg width='3' height='3' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E")`;
      case 'v-lines':
        return `url("data:image/svg+xml,%3Csvg width='2' height='1' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E")`;
      case 'h-lines':
        return `url("data:image/svg+xml,%3Csvg width='1' height='2' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='black'/%3E%3C/svg%3E")`;
      default:
        return 'none';
    }
  };

  return (
    <motion.div
      className="fixed inset-[-20px] z-[45] pointer-events-none opacity-50"
      style={{
        backgroundImage: getBackgroundImage(),
        backgroundRepeat: 'repeat',
        backgroundSize: type === 'pixel' ? '3px 3px' : type === 'v-lines' ? '2px 1px' : '1px 2px',
      }}
      animate={{
        x: prefersReducedMotion ? 0 : driftOffset.x * 2,
        y: prefersReducedMotion ? 0 : driftOffset.y * 2,
      }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut',
      }}
    />
  );
};
