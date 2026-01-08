# Manual Testing Guide - User Management & Password Recovery

## Prerequisites
1. MongoDB running and connected
2. Backend server running on port 5000
3. Frontend running on port 3000 (or built and served by backend)
4. At least one admin user exists (use seedAdmin.js)

## Setup Admin User
```bash
cd /home/runner/work/Docketra/Docketra
SEED_ADMIN=true node src/scripts/seedAdmin.js
```

Default admin credentials:
- xID: X000001
- Password: ChangeMe@123

## Test Suite

### 1. User Management Tests

#### Test 1.1: View Users List
1. Login as admin (X000001 / ChangeMe@123)
2. Navigate to Admin → Users
3. **Expected**: See list of all users with columns:
   - xID
   - Name
   - Email
   - Role (Admin/Employee)
   - Status (Active/Inactive)
   - Password Set (Yes/No)
   - Actions (Activate/Deactivate, Resend Email, Unlock)

#### Test 1.2: Create New User
1. In Admin → Users, click "Create User"
2. Fill in form:
   - xID: X000002
   - Name: Test Employee
   - Email: test@example.com
   - Role: Employee
3. Click "Create User"
4. **Expected**:
   - Success toast message
   - User appears in list with "Inactive" or "Active" status
   - Password Set = No
   - Console shows password setup email (check backend logs)

#### Test 1.3: Deactivate User
1. Find a user (NOT yourself) in the list
2. Click "Deactivate" button
3. **Expected**:
   - Success toast message
   - User status changes to "Inactive"
   - Badge color changes to red/rejected

#### Test 1.4: Activate User
1. Find an inactive user
2. Click "Activate" button
3. **Expected**:
   - Success toast message
   - User status changes to "Active"
   - Badge color changes to green/approved

#### Test 1.5: Prevent Self-Deactivation
1. Try to deactivate your own account (admin)
2. **Expected**: Error message "You cannot deactivate your own account"

#### Test 1.6: Resend Setup Email
1. Find a user with Password Set = No
2. Click "Resend Email"
3. **Expected**:
   - Success toast
   - Check backend console for password setup email with token link

### 2. Forgot Password Tests

#### Test 2.1: Access Forgot Password Page
1. Go to login page (logout if needed)
2. Click "Forgot Password?" link
3. **Expected**: Redirected to /forgot-password page

#### Test 2.2: Request Password Reset (Valid Email)
1. On forgot password page, enter: admin@docketra.local
2. Click "Send Reset Link"
3. **Expected**:
   - Success message displayed
   - Check backend console for password reset email with token
   - After 3 seconds, redirected to login with success message

#### Test 2.3: Request Password Reset (Invalid Email)
1. On forgot password page, enter: nonexistent@example.com
2. Click "Send Reset Link"
3. **Expected**:
   - Generic success message (security feature - no email enumeration)
   - No email shown in backend console

#### Test 2.4: Request Password Reset (Invalid Format)
1. Enter: not-an-email
2. Click "Send Reset Link"
3. **Expected**: Error message "Please enter a valid email address"

#### Test 2.5: Reset Password with Valid Token
1. From backend console, copy the reset password link
2. Open link in browser (should go to /reset-password?token=...)
3. Enter new password: NewPassword123
4. Confirm password: NewPassword123
5. Click "Reset Password"
6. **Expected**:
   - Success message
   - Redirected to login
   - Can login with new password

#### Test 2.6: Reset Password with Expired Token
1. Wait 31 minutes (or manually create an expired token)
2. Try to reset password
3. **Expected**: Error "Invalid or expired password reset token"

#### Test 2.7: Reset Password - Passwords Don't Match
1. Use a valid reset token
2. Password: NewPassword123
3. Confirm: DifferentPassword123
4. Click "Reset Password"
5. **Expected**: Error "Passwords do not match"

#### Test 2.8: Reset Password - Too Short
1. Use a valid reset token
2. Password: short
3. Confirm: short
4. Click "Reset Password"
5. **Expected**: Error "Password must be at least 8 characters"

### 3. Logout Tests

#### Test 3.1: Normal Logout
1. Login as any user
2. Click "Logout" button in top right
3. **Expected**:
   - Backend logs logout action
   - Redirected to /login
   - localStorage cleared (check DevTools → Application → Local Storage)

#### Test 3.2: Logout Persistence
1. Login as any user
2. Logout
3. Press browser back button
4. **Expected**: Redirected to /login (not able to see protected pages)

#### Test 3.3: Logout and Refresh
1. Login as any user
2. Logout
3. Refresh the page
4. **Expected**: Still on login page, not auto-logged in

#### Test 3.4: Direct URL Access After Logout
1. Login as any user
2. Logout
3. Try to navigate directly to /dashboard
4. **Expected**: Redirected to /login

#### Test 3.5: Protected Route Access
1. Logout
2. Try to access /admin
3. **Expected**: Redirected to /login
4. Login as employee
5. Try to access /admin
6. **Expected**: Redirected to /dashboard (not authorized)
7. Login as admin
8. Try to access /admin
9. **Expected**: Successfully view admin page

### 4. Inactive User Login Prevention

#### Test 4.1: Inactive User Cannot Login
1. Create a new user (Employee)
2. Deactivate the user
3. Logout
4. Try to login with that user's credentials
5. **Expected**: Error "Account is deactivated"

#### Test 4.2: Activate and Login
1. Admin activates the user
2. User tries to login again
3. **Expected**: Successful login (if password is set)

### 5. Integration Tests

#### Test 5.1: Complete New User Workflow
1. Admin creates user
2. Check console for password setup email
3. Copy token from email link
4. Open /set-password?token=... in browser
5. Set password
6. Login with new credentials
7. Access dashboard
8. **Expected**: Complete flow works end-to-end

#### Test 5.2: Complete Forgot Password Workflow
1. User forgets password
2. Request password reset via forgot password page
3. Check console for reset email
4. Copy token from email link
5. Reset password via link
6. Login with new password
7. **Expected**: Complete flow works end-to-end

#### Test 5.3: Admin User Management Flow
1. Admin creates multiple users (Admin and Employee roles)
2. Verify both appear in users list
3. Deactivate an employee
4. Try to login as that employee
5. Expected: Login fails
6. Activate the employee
7. Employee can now login
8. **Expected**: Complete admin workflow works

## Verification Checklist

After running all tests, verify:
- [ ] All user management operations work correctly
- [ ] Forgot password flow is complete and secure
- [ ] Logout properly clears session
- [ ] Protected routes are actually protected
- [ ] Role-based access control works (Admin vs Employee)
- [ ] Inactive users cannot login
- [ ] Email notifications are logged (console)
- [ ] All error messages are clear and helpful
- [ ] UI feedback (toasts, alerts) works properly
- [ ] Browser refresh maintains logout state

## Common Issues and Solutions

### Issue: "Cannot read properties of null"
**Solution**: Make sure MongoDB is running and connected

### Issue: "User already exists"
**Solution**: Use different xID or email when creating users

### Issue: "Invalid token"
**Solution**: Make sure to use the full token from the console, including all characters

### Issue: Email not received
**Solution**: Email is logged to console in development. Check backend server logs.

### Issue: Cannot deactivate user
**Solution**: You cannot deactivate your own account. Try with a different user.

### Issue: 401 Unauthorized
**Solution**: Make sure you're logged in and have the correct role (Admin for admin operations)

## Backend Log Locations

Check these console outputs during testing:
1. Password setup emails
2. Forgot password emails
3. Login/logout audit logs
4. Password reset links with tokens

## Browser DevTools Checks

### Local Storage
Navigate to DevTools → Application → Local Storage → http://localhost:3000
- Check for `xID` and `user` keys when logged in
- Verify they're cleared after logout

### Network Tab
Monitor API calls to verify:
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password-with-token
- GET /api/auth/admin/users
- POST /api/auth/admin/users

### Console
Check for any JavaScript errors during navigation

## Security Testing

### Test Email Enumeration Protection
1. Request password reset for existing email
2. Request password reset for non-existing email
3. **Verify**: Both show same generic message

### Test Token Security
1. Try to use a token twice
2. **Verify**: Second attempt fails

### Test Token Expiry
1. Wait 31 minutes after requesting reset
2. Try to use token
3. **Verify**: Token is expired

### Test Admin Protection
1. Login as Employee
2. Try to access admin endpoints via API (use DevTools Network tab)
3. **Verify**: 403 Forbidden responses
