'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  onExpire?: () => void;
}

export function CountdownTimer({ targetDate, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        if (onExpire) {
          onExpire();
        }
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  // Always show the countdown, even if expired (show zeros)
  if (timeLeft.expired) {
    return (
      <div className="flex items-center justify-center gap-2 sm:gap-4 mt-4">
        <div className="flex flex-col items-center">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">00</div>
          <div className="text-xs sm:text-sm text-gray-500 uppercase">Days</div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-gray-400">:</div>
        <div className="flex flex-col items-center">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">00</div>
          <div className="text-xs sm:text-sm text-gray-500 uppercase">Hours</div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-gray-400">:</div>
        <div className="flex flex-col items-center">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">00</div>
          <div className="text-xs sm:text-sm text-gray-500 uppercase">Minutes</div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-gray-400">:</div>
        <div className="flex flex-col items-center">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">00</div>
          <div className="text-xs sm:text-sm text-gray-500 uppercase">Seconds</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mt-4">
      <div className="flex flex-col items-center">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900">{String(timeLeft.days).padStart(2, '0')}</div>
        <div className="text-xs sm:text-sm text-gray-500 uppercase">Days</div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-400">:</div>
      <div className="flex flex-col items-center">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900">{String(timeLeft.hours).padStart(2, '0')}</div>
        <div className="text-xs sm:text-sm text-gray-500 uppercase">Hours</div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-400">:</div>
      <div className="flex flex-col items-center">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900">{String(timeLeft.minutes).padStart(2, '0')}</div>
        <div className="text-xs sm:text-sm text-gray-500 uppercase">Minutes</div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-400">:</div>
      <div className="flex flex-col items-center">
        <div className="text-2xl sm:text-3xl font-bold text-gray-900">{String(timeLeft.seconds).padStart(2, '0')}</div>
        <div className="text-xs sm:text-sm text-gray-500 uppercase">Seconds</div>
      </div>
    </div>
  );
}
