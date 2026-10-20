import React, { useEffect, useState } from 'react';

interface HeaderProps {
  statusText: string;
  isOnline: boolean;
  sourceTooltip?: string;
}

export const Header: React.FC<HeaderProps> = ({ statusText, isOnline, sourceTooltip }) => {
  const [clock, setClock] = useState<string>('--:--:--');

  useEffect(() => {
    const updateTime = () => {
      setClock(
        new Date().toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header>
      <div className="logo">
        ✈ Mumbai <span>Air Control</span>
      </div>
      <div className="pill" title={sourceTooltip}>
        <span className={`dot ${isOnline ? '' : 'bad'}`} />
        <span>{statusText}</span>
      </div>
      <div className="pill">
        IST <span id="clock">{clock}</span>
      </div>
    </header>
  );
};
