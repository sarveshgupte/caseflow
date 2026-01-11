# Google Drive Operational Monitoring Guide

## Overview

This document provides guidelines for monitoring and maintaining the Google Drive integration for Docketra's Case File System (CFS) and Client CFS.

## Drive API Quota Monitoring

### Quota Limits

Google Drive API has the following default quota limits:
- **Queries per day**: 1,000,000,000
- **Queries per 100 seconds per user**: 1,000
- **Queries per 100 seconds**: 10,000

### Monitoring Recommendations

1. **Set up Google Cloud Console Monitoring**
   - Navigate to Google Cloud Console → APIs & Services → Dashboard
   - Select Google Drive API
   - Monitor usage metrics under "Quotas" tab
   - Set up alerts for when usage reaches 80% of quota

2. **Log Analysis**
   - Review application logs for Drive API error patterns
   - Look for `429 Too Many Requests` errors
   - Monitor response times for Drive operations

3. **Usage Patterns to Watch**
   - Bulk file uploads during peak hours
   - Case cloning operations (involves multiple file operations)
   - Large file downloads (may impact bandwidth)

4. **Optimization Strategies**
   - Implement exponential backoff for rate limit errors
   - Use batch operations where possible
   - Cache folder IDs to reduce folder lookup calls
   - Consider queueing large operations during off-peak hours

### Quota Increase Requests

If you consistently hit quota limits:
1. Visit Google Cloud Console → APIs & Services → Quotas
2. Select Google Drive API quotas
3. Click "Edit Quotas" and submit increase request
4. Provide business justification and expected usage

## Service Account Key Rotation

### Best Practices

**Rotation Schedule**: Rotate service account keys every 90 days

### Rotation Procedure

1. **Generate New Key**
   ```bash
   # Using gcloud CLI
   gcloud iam service-accounts keys create new-key.json \
     --iam-account=SERVICE_ACCOUNT_EMAIL
   ```

2. **Update Environment Variable**
   - Store new key in secure location (e.g., AWS Secrets Manager, Azure Key Vault)
   - Update `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable
   - Verify JSON format is valid

3. **Deploy Update**
   - Deploy application with new key
   - Monitor logs for successful Drive service initialization
   - Verify file operations work correctly

4. **Deactivate Old Key**
   - Wait 24-48 hours to ensure no legacy instances use old key
   - Disable old key in Google Cloud Console:
     ```
     Google Cloud Console → IAM & Admin → Service Accounts
     → Select Service Account → Keys → Delete old key
     ```

5. **Update Documentation**
   - Document rotation date
   - Update key reference in infrastructure documentation

### Emergency Key Rotation

If a key is compromised:
1. Immediately revoke the compromised key in Google Cloud Console
2. Generate and deploy new key within 1 hour
3. Audit recent Drive API access logs for suspicious activity
4. Review all files in Drive root folder for unauthorized changes

## Service Account Revocation Procedure

### When to Revoke

- Service account key is compromised
- Service account is no longer needed
- Security audit identifies unauthorized access
- Employee with key access leaves organization

### Revocation Steps

1. **Immediate Action**
   ```bash
   # Delete all keys for service account
   gcloud iam service-accounts keys list \
     --iam-account=SERVICE_ACCOUNT_EMAIL
   
   gcloud iam service-accounts keys delete KEY_ID \
     --iam-account=SERVICE_ACCOUNT_EMAIL
   ```

2. **Remove Drive Access**
   - Navigate to Google Drive root folder
   - Remove service account from folder sharing permissions
   - Verify service account has no remaining Drive access

3. **Disable Service Account**
   ```bash
   gcloud iam service-accounts disable SERVICE_ACCOUNT_EMAIL
   ```

4. **Application Impact**
   - Application will fail to access Drive immediately
   - All file upload/download operations will fail
   - Monitor error logs for Drive authentication failures

5. **Recovery Plan**
   - Create new service account
   - Grant necessary IAM roles
   - Share Drive root folder with new service account
   - Generate key and update application
   - Test file operations

### Audit Trail

After revocation, maintain audit record:
- Date and time of revocation
- Reason for revocation
- Performed by (administrator name)
- Impact assessment (which services affected)
- Recovery actions taken

## Security Best Practices

### Access Control

1. **Principle of Least Privilege**
   - Grant service account minimum required permissions
   - Review IAM roles quarterly
   - Never grant "Owner" role to service account

2. **Folder Isolation**
   - Each firm has dedicated folder (`firm_<firmId>`)
   - Service account should only access designated root folder
   - No cross-firm folder access

3. **Key Storage**
   - Never commit keys to version control
   - Store keys in encrypted secrets manager
   - Restrict access to key storage to authorized personnel only

### Monitoring & Alerts

1. **Set Up Alerts For**
   - Unexpected API quota spikes
   - Authentication failures
   - File deletion operations (unusual activity)
   - Access from unexpected IP addresses

2. **Log Retention**
   - Retain Drive API access logs for minimum 90 days
   - Archive logs to cold storage for compliance
   - Ensure logs include: timestamp, operation type, file ID, user context

## Troubleshooting

### Common Issues

1. **"Rate limit exceeded" errors**
   - Implement exponential backoff
   - Reduce operation frequency
   - Request quota increase

2. **"Authentication failed" errors**
   - Verify service account JSON is valid
   - Check service account has Drive API enabled
   - Verify root folder is shared with service account

3. **"File not found" errors**
   - Validate folder IDs in database match Drive
   - Check file hasn't been moved/deleted in Drive
   - Verify firm isolation (correct firmId)

4. **Slow file operations**
   - Check network connectivity
   - Monitor Drive API response times
   - Consider implementing streaming for large files
   - Use Cloud CDN if available

## Disaster Recovery

### Backup Strategy

1. **Folder Structure Backup**
   - Maintain database backup of all folder IDs
   - Document folder hierarchy
   - Test folder recreation scripts regularly

2. **File Metadata Backup**
   - Database contains file references (driveFileId)
   - Regular database backups include attachment metadata
   - Consider Drive API export for critical files

3. **Recovery Procedure**
   - Restore database from backup
   - Verify Drive folder structure integrity
   - Validate all folder IDs are accessible
   - Test file upload/download operations

### Business Continuity

If Drive is unavailable:
1. Application will gracefully handle errors (see error handling in controllers)
2. Users can continue case operations (except file uploads/downloads)
3. Queue file operations for retry when service recovers
4. Communicate estimated recovery time to users

## Compliance & Auditing

### Data Residency

- Verify Drive storage location meets data residency requirements
- Document data storage region in compliance records
- Review Google Cloud data processing terms

### Audit Requirements

Maintain audit logs for:
- All file upload operations (who, when, which file)
- All file deletion operations (admin-only)
- Service account key rotations
- Access permission changes

### Retention Policy

- Client CFS documents: Retain per client retention policy
- Case attachments: Retain per case lifecycle
- Audit logs: Minimum 7 years for legal compliance

## Contact & Support

### Google Cloud Support

- **Support Portal**: https://cloud.google.com/support
- **Support Plans**: Basic (free), Silver, Gold, Platinum
- **Response Times**: Vary by support plan and issue severity

### Internal Contacts

- **Infrastructure Team**: Responsible for key rotation and access management
- **Security Team**: Responsible for security audits and incident response
- **Development Team**: Responsible for application-level Drive integration

### Escalation Procedure

1. **P1 (Critical)**: Drive service completely unavailable
   - Contact: Infrastructure team immediately
   - SLA: 1 hour response time

2. **P2 (High)**: Partial service degradation
   - Contact: Development team
   - SLA: 4 hour response time

3. **P3 (Medium)**: Performance issues
   - Contact: Development team
   - SLA: 1 business day

4. **P4 (Low)**: General questions
   - Contact: Development team
   - SLA: 3 business days

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-11  
**Next Review Date**: 2026-04-11
