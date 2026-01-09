/**
 * Verification Script for xID Canonicalization
 * 
 * This script verifies that all the xID migration changes have been implemented
 * correctly by checking key files and code patterns.
 * 
 * Run this after applying the migration to verify everything is in place.
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '═'.repeat(50));
console.log('  xID CANONICALIZATION VERIFICATION');
console.log('═'.repeat(50) + '\n');

let errors = 0;
let warnings = 0;
let passed = 0;

function checkFileContains(filePath, pattern, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(pattern)) {
      console.log(`✅ ${description}`);
      passed++;
      return true;
    } else {
      console.log(`❌ ${description}`);
      errors++;
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description} - File not found: ${filePath}`);
    errors++;
    return false;
  }
}

function checkFileDoesNotContain(filePath, pattern, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(pattern)) {
      console.log(`✅ ${description}`);
      passed++;
      return true;
    } else {
      console.log(`⚠️  ${description}`);
      warnings++;
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description} - File not found: ${filePath}`);
    errors++;
    return false;
  }
}

console.log('📋 Checking Case Model Schema\n');
checkFileContains('models/Case.model.js', 'assignedToXID:', 'Case model has assignedToXID field');
checkFileContains('models/Case.model.js', 'assignedToXID: 1', 'Index on assignedToXID exists');
checkFileContains('models/Case.model.js', 'DEPRECATED', 'Legacy assignedTo field is marked deprecated');

console.log('\n📋 Checking Assignment Service\n');
checkFileContains('services/caseAssignment.service.js', 'assignedToXID:', 'Assignment service writes to assignedToXID');
checkFileDoesNotContain('services/caseAssignment.service.js', 'assignedTo: user.xID', 'Assignment service does not write to legacy assignedTo');

console.log('\n📋 Checking Bulk Pull API\n');
checkFileContains('controllers/case.controller.js', 'userXID', 'Bulk pull accepts userXID parameter');
checkFileContains('controllers/case.controller.js', 'userEmail parameter is deprecated', 'Bulk pull rejects userEmail parameter');

console.log('\n📋 Checking Worklist Queries\n');
checkFileContains('controllers/search.controller.js', 'assignedToXID: user.xID', 'Employee worklist queries assignedToXID');
checkFileContains('controllers/caseActions.controller.js', 'assignedToXID: req.user.xID', 'My Pending Cases queries assignedToXID');

console.log('\n📋 Checking Case History Model\n');
checkFileContains('models/CaseHistory.model.js', 'performedByXID:', 'CaseHistory model has performedByXID field');
checkFileContains('models/CaseHistory.model.js', 'performedByXID: 1', 'Index on performedByXID exists');

console.log('\n📋 Checking Reports Controller\n');
checkFileContains('controllers/reports.controller.js', 'assignedToXID:', 'Reports controller uses assignedToXID');
checkFileContains('controllers/reports.controller.js', 'matchStage.assignedToXID = assignedTo', 'Reports controller queries assignedToXID');

console.log('\n📋 Checking Migration Script\n');
checkFileContains('scripts/migrateToAssignedToXID.js', 'assignedTo → assignedToXID', 'Migration script exists');
checkFileContains('scripts/migrateToAssignedToXID.js', 'DRY_RUN', 'Migration script has dry-run mode');

console.log('\n' + '═'.repeat(50));
console.log('  VERIFICATION RESULTS');
console.log('═'.repeat(50) + '\n');
console.log(`✅ Passed:   ${passed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Errors:   ${errors}\n`);

if (errors > 0) {
  console.log('❌ VERIFICATION FAILED - Please fix errors above\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('⚠️  VERIFICATION PASSED WITH WARNINGS\n');
  process.exit(0);
} else {
  console.log('✅ VERIFICATION PASSED - All checks successful!\n');
  process.exit(0);
}
