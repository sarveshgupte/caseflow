/**
 * Repository Layer Index
 * 
 * Centralized export of all firm-scoped repositories.
 * Controllers and services should import from here.
 */

const CaseRepository = require('./CaseRepository');
const ClientRepository = require('./ClientRepository');
const UserRepository = require('./UserRepository');

module.exports = {
  CaseRepository,
  ClientRepository,
  UserRepository,
};
