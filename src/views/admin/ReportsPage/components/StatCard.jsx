import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, trend, description }) => (
  <motion.div
    whileHover={{ y: -5, scale: 1.02 }}
    className="stat-card"
  >
    <div className="stat-card-overlay" />

    <div className={`stat-card-icon ${color}`}>
      <Icon size={24} />
    </div>

    <div className="stat-card-content">
      <h3 className="stat-card-title">{title}</h3>
      <div className="stat-card-value-container">
        <p className="stat-card-value">{value}</p>
        {trend && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`stat-card-trend ${trend.direction === 'up' ? 'trend-up' : 'trend-down'}`}
          >
            <TrendingUp size={12} />
            {trend.value}
          </motion.span>
        )}
      </div>
      {description && <p className="stat-card-description">{description}</p>}
    </div>
  </motion.div>
);

export default StatCard;
