import logger from './logger.js';

/**
 * Node Participant State Machine
 * 
 * States: inactive, active, busy, paused, draining, offline, unhealthy
 * 
 * Version: 1
 */

export const NODE_STATES = Object.freeze({
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  BUSY: 'busy',
  PAUSED: 'paused',
  DRAINING: 'draining',
  OFFLINE: 'offline',
  UNHEALTHY: 'unhealthy',
});

// Valid state transitions: from → [allowed targets]
const VALID_TRANSITIONS = {
  inactive: ['active'],
  active: ['busy', 'paused', 'draining', 'inactive', 'offline', 'unhealthy'],
  busy: ['active', 'paused', 'draining', 'offline', 'unhealthy'],
  paused: ['active', 'offline', 'inactive'],
  draining: ['inactive', 'offline'],
  offline: ['active', 'inactive'],
  unhealthy: ['active', 'offline', 'inactive'],
};

/**
 * Validate if a state transition is allowed.
 * @param {string} fromState - Current state
 * @param {string} toState - Target state
 * @returns {{ valid: boolean, reason?: string }}
 */
export const validateTransition = (fromState, toState) => {
  const normalized = { from: fromState?.toLowerCase(), to: toState?.toLowerCase() };
  
  if (!VALID_TRANSITIONS[normalized.from]) {
    return { valid: false, reason: `Unknown current state: ${fromState}` };
  }
  
  if (!VALID_TRANSITIONS[normalized.to] && !Object.values(NODE_STATES).includes(normalized.to)) {
    return { valid: false, reason: `Unknown target state: ${toState}` };
  }
  
  if (normalized.from === normalized.to) {
    return { valid: true }; // No-op transition is allowed
  }
  
  const allowed = VALID_TRANSITIONS[normalized.from];
  if (!allowed.includes(normalized.to)) {
    return { valid: false, reason: `Transition from '${fromState}' to '${toState}' is not allowed` };
  }
  
  return { valid: true };
};

/**
 * Attempt to transition a node to a new state.
 * @param {Object} node - NodeDevice mongoose document
 * @param {string} targetState - Target state
 * @param {Object} [context] - Additional context for logging
 * @returns {{ success: boolean, previousState: string, newState: string, reason?: string }}
 */
export const transitionNode = async (node, targetState, context = {}) => {
  const previousState = node.status || 'inactive';
  const result = validateTransition(previousState, targetState);
  
  if (!result.valid) {
    logger.warn({
      nodeId: node._id?.toString(),
      from: previousState,
      to: targetState,
      reason: result.reason,
      ...context,
    }, `Node state transition rejected: ${result.reason}`);
    return { success: false, previousState, newState: previousState, reason: result.reason };
  }
  
  node.status = targetState;
  node.lastSeenAt = new Date();
  await node.save();
  
  logger.info({
    nodeId: node._id?.toString(),
    from: previousState,
    to: targetState,
    event: `NODE_${targetState.toUpperCase()}`,
    ...context,
  }, `Node state: ${previousState} → ${targetState}`);
  
  return { success: true, previousState, newState: targetState };
};

/**
 * Check if a node is eligible for task allocation.
 */
export const isEligibleForTasks = (node) => {
  const eligibleStates = [NODE_STATES.ACTIVE];
  return eligibleStates.includes(node.status) && 
         (node.currentActiveTasks || 0) < (node.maxConcurrentTasks || 1);
};

/**
 * Check if a node should accept new tasks (not paused, not draining, not unhealthy).
 */
export const canAcceptNewTasks = (node) => {
  const blockingStates = [NODE_STATES.PAUSED, NODE_STATES.DRAINING, NODE_STATES.INACTIVE, NODE_STATES.OFFLINE, NODE_STATES.UNHEALTHY];
  return !blockingStates.includes(node.status) && isEligibleForTasks(node);
};

export default {
  NODE_STATES,
  validateTransition,
  transitionNode,
  isEligibleForTasks,
  canAcceptNewTasks,
};
