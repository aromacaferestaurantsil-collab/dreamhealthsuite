import { DynamicIcon } from 'lucide-react/dynamic';
import { memo } from 'react';

function ApperIcon({ name, size = 20, className = '', ...props }) {
  if (!name) return null;
  const iconName = String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return <DynamicIcon name={iconName} size={size} className={className} {...props} />;
}

export default memo(ApperIcon);