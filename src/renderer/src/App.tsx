import { useState, useEffect, useRef } from 'react';

function App() {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  const presetTimes = [
    { label: '15 MIN', minutes: 15 },
    { label: '30 MIN', minutes: 30 },
    { label: '60 MIN', minutes: 60 },
    { label: '120 MIN', minutes: 120 },
  ];

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            setIsActive(false);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, timeLeft]);

  const startTimer = (minutes: number) => {
    setTimeLeft(minutes * 60);
    setIsActive(true);
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  const resumeTimer = () => {
    if (timeLeft > 0) {
      setIsActive(true);
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(0);
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="mb-16">
        <h1 className="text-6xl md:text-7xl font-bold text-white tracking-wide">
          LockedIn
        </h1>
      </div>

      {/* Timer Display */}
      <div className="mb-16">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur-xl opacity-20"></div>
          <div className="relative bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-3xl px-16 py-12 shadow-2xl">
            <div className="text-8xl md:text-9xl font-bold text-white font-mono tracking-wider">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* Preset Time Buttons */}
      {!isActive && timeLeft === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {presetTimes.map((preset) => (
            <button
              key={preset.minutes}
              onClick={() => startTimer(preset.minutes)}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 min-w-[120px]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Control Buttons */}
      {(isActive || timeLeft > 0) && (
        <div className="flex gap-4">
          {isActive ? (
            <button
              onClick={pauseTimer}
              className="px-10 py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={resumeTimer}
              className="px-10 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Resume
            </button>
          )}
          <button
            onClick={resetTimer}
            className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
