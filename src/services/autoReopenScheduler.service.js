const caseActionService = require('./caseAction.service');

/**
 * Pending Case Auto-Reopen Scheduler
 * 
 * Periodically checks for pended cases where pendingUntil has passed
 * and automatically reopens them.
 * 
 * This service should be called by a cron job or scheduler.
 * For example, run every hour or every 15 minutes depending on requirements.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

/**
 * Run the auto-reopen job
 * 
 * Finds all PENDED cases where pendingUntil <= now and reopens them.
 * Logs results for monitoring.
 * 
 * @returns {Promise<object>} Results with count of reopened cases
 */
const runAutoReopenJob = async () => {
  try {
    console.log('[AutoReopen] Starting auto-reopen job...');
    
    const result = await caseActionService.autoReopenPendedCases();
    
    if (result.count > 0) {
      console.log(`[AutoReopen] Successfully reopened ${result.count} case(s)`);
      console.log(`[AutoReopen] Case IDs: ${result.cases.join(', ')}`);
    } else {
      console.log('[AutoReopen] No cases to reopen');
    }
    
    return result;
  } catch (error) {
    console.error('[AutoReopen] Error running auto-reopen job:', error);
    throw error;
  }
};

/**
 * Start the scheduler (optional)
 * 
 * Runs the auto-reopen job at specified intervals.
 * Call this from server.js to enable automatic scheduling.
 * 
 * @param {number} intervalMinutes - Interval in minutes (default: 60)
 */
const startScheduler = (intervalMinutes = 60) => {
  console.log(`[AutoReopen] Scheduler started (runs every ${intervalMinutes} minutes)`);
  
  // Run immediately on startup
  runAutoReopenJob().catch(err => {
    console.error('[AutoReopen] Initial run failed:', err);
  });
  
  // Then run at specified intervals
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(async () => {
    try {
      await runAutoReopenJob();
    } catch (error) {
      console.error('[AutoReopen] Scheduled run failed:', error);
    }
  }, intervalMs);
};

module.exports = {
  runAutoReopenJob,
  startScheduler,
};
