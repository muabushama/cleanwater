import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';

interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  icon: ReactNode;
  gradient: string;
  delay?: number;
}

export function StatCard({ title, value, suffix = '', icon, gradient, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`${gradient} rounded-2xl p-5 text-primary-foreground card-shadow-lg relative overflow-hidden`}
    >
      <div className="absolute top-0 left-0 w-full h-full opacity-10">
        <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full bg-white/20" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full bg-white/10" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm opacity-90">{title}</span>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold">
          <AnimatedCounter end={value} suffix={suffix} />
        </div>
      </div>
    </motion.div>
  );
}
