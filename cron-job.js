import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const CronJobScheduler = () => {
  const [jobs, setJobs] = useState([]);
  const [newJob, setNewJob] = useState({
    name: '',
    schedule: '',
    command: '',
    timeout: 5000
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef(null);

  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Check jobs every second
    intervalRef.current = setInterval(() => {
      checkAndExecuteJobs();
    }, 1000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(intervalRef.current);
    };
  }, [jobs]);

  const parseCronExpression = (cron) => {
    // Simplified cron parser: "* * * * *" (minute hour day month weekday)
    // For demo purposes, supporting: */N (every N units), * (every), and specific numbers
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    
    return {
      minute: parts[0],
      hour: parts[1],
      day: parts[2],
      month: parts[3],
      weekday: parts[4]
    };
  };

  const matchesCronPart = (cronPart, currentValue, max) => {
    if (cronPart === '*') return true;
    
    // Handle */N pattern
    if (cronPart.startsWith('*/')) {
      const interval = parseInt(cronPart.slice(2));
      return currentValue % interval === 0;
    }
    
    // Handle comma-separated values
    if (cronPart.includes(',')) {
      return cronPart.split(',').some(v => parseInt(v) === currentValue);
    }
    
    // Handle range
    if (cronPart.includes('-')) {
      const [start, end] = cronPart.split('-').map(v => parseInt(v));
      return currentValue >= start && currentValue <= end;
    }
    
    return parseInt(cronPart) === currentValue;
  };

  const shouldExecute = (job, now) => {
    if (!job.enabled) return false;
    
    const cron = parseCronExpression(job.schedule);
    if (!cron) return false;

    const minute = now.getMinutes();
    const hour = now.getHours();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const weekday = now.getDay();

    // Check if we already executed this minute
    if (job.lastExecutedMinute === minute && job.lastExecutedHour === hour) {
      return false;
    }

    return (
      matchesCronPart(cron.minute, minute, 59) &&
      matchesCronPart(cron.hour, hour, 23) &&
      matchesCronPart(cron.day, day, 31) &&
      matchesCronPart(cron.month, month, 12) &&
      matchesCronPart(cron.weekday, weekday, 6)
    );
  };

  const executeJob = async (job) => {
    const executionId = Date.now();
    const startTime = Date.now();

    // Update job status to running
    setJobs(prev => prev.map(j => 
      j.id === job.id 
        ? { ...j, status: 'running', lastExecutedMinute: currentTime.getMinutes(), lastExecutedHour: currentTime.getHours() }
        : j
    ));

    try {
      // Simulate job execution with timeout
      const result = await Promise.race([
        simulateJobExecution(job.command),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), job.timeout)
        )
      ]);

      const duration = Date.now() - startTime;

      // Job succeeded
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? {
              ...j,
              status: 'success',
              lastExecution: new Date(),
              lastResult: result,
              executionHistory: [
                {
                  id: executionId,
                  timestamp: new Date(),
                  status: 'success',
                  duration,
                  result
                },
                ...(j.executionHistory || [])
              ].slice(0, 10)
            }
          : j
      ));
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error.message === 'Timeout';

      // Job failed
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? {
              ...j,
              status: isTimeout ? 'timeout' : 'failed',
              lastExecution: new Date(),
              lastError: error.message,
              executionHistory: [
                {
                  id: executionId,
                  timestamp: new Date(),
                  status: isTimeout ? 'timeout' : 'failed',
                  duration,
                  error: error.message
                },
                ...(j.executionHistory || [])
              ].slice(0, 10)
            }
          : j
      ));
    }
  };

  const simulateJobExecution = (command) => {
    // Simulate different job types
    return new Promise((resolve, reject) => {
      const executionTime = Math.random() * 3000 + 500;
      
      setTimeout(() => {
        // 10% chance of failure for demo purposes
        if (Math.random() < 0.1) {
          reject(new Error('Job execution failed'));
        } else {
          resolve(`Executed: ${command} - Output: Success at ${new Date().toLocaleTimeString()}`);
        }
      }, executionTime);
    });
  };

  const checkAndExecuteJobs = () => {
    const now = new Date();
    jobs.forEach(job => {
      if (shouldExecute(job, now)) {
        executeJob(job);
      }
    });
  };

  const addJob = () => {
    if (!newJob.name || !newJob.schedule || !newJob.command) {
      alert('Please fill in all fields');
      return;
    }

    const cron = parseCronExpression(newJob.schedule);
    if (!cron) {
      alert('Invalid cron expression. Use format: * * * * * (minute hour day month weekday)');
      return;
    }

    const job = {
      id: Date.now(),
      ...newJob,
      enabled: true,
      status: 'idle',
      executionHistory: []
    };

    setJobs([...jobs, job]);
    setNewJob({ name: '', schedule: '', command: '', timeout: 5000 });
  };

  const toggleJob = (id) => {
    setJobs(prev => prev.map(j => 
      j.id === id ? { ...j, enabled: !j.enabled, status: j.enabled ? 'disabled' : 'idle' } : j
    ));
  };

  const deleteJob = (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'timeout':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'timeout':
        return 'bg-orange-100 text-orange-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'disabled':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Cron Job Scheduler</h1>
          <p className="text-gray-600 mb-4">Current Time: {currentTime.toLocaleString()}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <input
              type="text"
              placeholder="Job Name"
              className="border border-gray-300 rounded px-3 py-2"
              value={newJob.name}
              onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Cron Schedule (e.g., */1 * * * *)"
              className="border border-gray-300 rounded px-3 py-2"
              value={newJob.schedule}
              onChange={(e) => setNewJob({ ...newJob, schedule: e.target.value })}
            />
            <input
              type="text"
              placeholder="Command"
              className="border border-gray-300 rounded px-3 py-2"
              value={newJob.command}
              onChange={(e) => setNewJob({ ...newJob, command: e.target.value })}
            />
            <input
              type="number"
              placeholder="Timeout (ms)"
              className="border border-gray-300 rounded px-3 py-2"
              value={newJob.timeout}
              onChange={(e) => setNewJob({ ...newJob, timeout: parseInt(e.target.value) })}
            />
          </div>
          
          <button
            onClick={addJob}
            className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition"
          >
            Add Job
          </button>

          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-gray-700">
              <strong>Cron Format:</strong> minute hour day month weekday
              <br />
              <strong>Examples:</strong> */1 * * * * (every minute) | 0 */2 * * * (every 2 hours) | 30 9 * * 1-5 (9:30 AM weekdays)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-800">{job.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Schedule: {job.schedule}</p>
                  <p className="text-sm text-gray-600 mb-1">Command: {job.command}</p>
                  <p className="text-sm text-gray-600">Timeout: {job.timeout}ms</p>
                  {job.lastExecution && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last Execution: {job.lastExecution.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleJob(job.id)}
                    className={`p-2 rounded ${job.enabled ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {job.enabled ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {job.executionHistory && job.executionHistory.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Execution History</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {job.executionHistory.map(execution => (
                      <div key={execution.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                        {getStatusIcon(execution.status)}
                        <div className="flex-1 text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-gray-700">
                              {execution.timestamp.toLocaleString()}
                            </span>
                            <span className="text-gray-500">{execution.duration}ms</span>
                          </div>
                          {execution.status === 'success' && (
                            <p className="text-gray-600">{execution.result}</p>
                          )}
                          {(execution.status === 'failed' || execution.status === 'timeout') && (
                            <p className="text-red-600">Error: {execution.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No jobs scheduled yet. Add your first cron job above!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CronJobScheduler;
