/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Chip } from '@mui/material';

export function flattenTree(items: any[]): any[] {
  const out: any[] = [];
  const walk = (arr: any[]) => {
    for (const i of arr) {
      out.push(i);
      if (i.children?.length) walk(i.children);
    }
  };
  walk(items);
  return out;
}

export const StatusChip: React.FC<{ value?: string }> = ({ value }) => {
  if (!value) return null;
  const color =
    value === 'Found' || value === 'Completed'
      ? 'success'
      : value === 'Damaged'
        ? 'error'
        : value === 'Shortages'
          ? 'warning'
          : value === 'In Repair'
            ? 'info'
            : 'default';
  return <Chip label={value} size="small" color={color as any} />;
};
